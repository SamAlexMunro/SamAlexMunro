// fabric-component.ts
import {
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { gsap } from 'gsap';
import * as THREE from 'three';

@Component({
  selector: 'app-fabric-simulation',
  standalone: true,
  template: `
    <div class="fabric-container" #container>
      <canvas #canvas></canvas>
    </div>
  `,
  styles: [
    `
      .fabric-container {
        width: 100%;
        height: 100vh;
        overflow: hidden;
      }
      canvas {
        display: block;
      }
    `,
  ],
})
export class FabricSimulationComponent implements OnInit, OnDestroy {
  @ViewChild('container', { static: true })
  container!: ElementRef<HTMLDivElement>;
  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private cloth!: THREE.Mesh;

  // Store initial particle positions for reset
  private initialPositions: THREE.Vector3[] = [];

  // Cloth properties
  private clothWidth = 60;
  private clothHeight = 50; // Increased for more banner-like appearance
  private segmentsW = 40;
  private segmentsH = 30;

  // Physics properties
  private particles: Particle[] = [];
  private constraints: Constraint[] = [];
  private windForce = new THREE.Vector3(0, 0, 0);
  private DAMPING = 0.02; // Reduced for more fluid movement
  private DRAG = 1 - this.DAMPING;
  private MASS = 0.1;
  private restDistance: number;

  // Safety limits to prevent simulation explosion
  private MAX_DISPLACEMENT = 5;

  // Animation properties
  private previousScrollY = 0;
  private scrollVelocity = 0;
  private maxScrollVelocity = 15;
  private animationFrameId: number | null = null;
  private timeStep = 1 / 60;
  private lastScrollTime = 0;
  private resetTimeout: any = null;
  private isSimulationActive = false;

  constructor(private ngZone: NgZone) {
    this.restDistance = (this.clothWidth / this.segmentsW) * 0.9;
  }

  ngOnInit(): void {
    this.initThreeJS();
    this.createCloth();
    this.setupScene();
    this.setupScrollListener();
    this.renderStaticScene(); // Just render once initially
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('scroll', this.handleScroll);
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
    }

    // Clean up Three.js resources
    this.scene.clear();
    this.renderer.dispose();
  }

  private initThreeJS(): void {
    // Initialize scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0f0f0);

    // Initialize camera
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 1, 10000);
    this.camera.position.set(0, 0, 80);
    this.camera.lookAt(0, 0, 0);

    // Initialize renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas.nativeElement,
      antialias: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    this.scene.add(directionalLight);

    // Add a more dramatic point light from the front
    const pointLight = new THREE.PointLight(0xffffff, 0.5);
    pointLight.position.set(0, 0, 100);
    this.scene.add(pointLight);

    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());
  }

  private createCloth(): void {
    // Create particles and constraints
    this.particles = [];
    this.constraints = [];
    this.initialPositions = [];

    // Create particles in a grid - all in a flat plane initially
    const clothFunction = (u: number, v: number) => {
      const x = (u - 0.5) * this.clothWidth;
      const y = (v - 0.5) * this.clothHeight;
      const z = 0; // Start completely flat
      return new THREE.Vector3(x, y, z);
    };

    // Create particles
    for (let v = 0; v <= this.segmentsH; v++) {
      for (let u = 0; u <= this.segmentsW; u++) {
        const pos = clothFunction(u / this.segmentsW, v / this.segmentsH);
        // Store initial position for reset
        this.initialPositions.push(pos.clone());

        const particle = new Particle(pos, this.MASS);

        // Pin the entire top row to simulate hanging from a banner
        if (v === 0) {
          particle.pinned = true;
        }

        this.particles.push(particle);
      }
    }

    // Create structural constraints (connect adjacent particles)
    for (let v = 0; v < this.segmentsH; v++) {
      for (let u = 0; u < this.segmentsW; u++) {
        const p1 = this.particles[this.index(u, v)];
        const p2 = this.particles[this.index(u + 1, v)];
        const p3 = this.particles[this.index(u, v + 1)];

        this.constraints.push(new Constraint(p1, p2, this.restDistance));
        this.constraints.push(new Constraint(p1, p3, this.restDistance));
      }
    }

    // Add last column and row
    for (let u = 0; u < this.segmentsW; u++) {
      const p1 = this.particles[this.index(u, this.segmentsH)];
      const p2 = this.particles[this.index(u + 1, this.segmentsH)];
      this.constraints.push(new Constraint(p1, p2, this.restDistance));
    }

    for (let v = 0; v < this.segmentsH; v++) {
      const p1 = this.particles[this.index(this.segmentsW, v)];
      const p2 = this.particles[this.index(this.segmentsW, v + 1)];
      this.constraints.push(new Constraint(p1, p2, this.restDistance));
    }

    // Create the mesh geometry and material
    const geometry = new THREE.PlaneGeometry(
      this.clothWidth,
      this.clothHeight,
      this.segmentsW,
      this.segmentsH
    );

    const material = new THREE.MeshPhongMaterial({
      color: 0x1e90ff,
      side: THREE.DoubleSide,
      flatShading: false,
      wireframe: false,
      shininess: 30,
    });

    // Create the cloth mesh
    this.cloth = new THREE.Mesh(geometry, material);
    this.cloth.castShadow = true;
    this.cloth.receiveShadow = true;
    this.cloth.position.set(0, 50, 0);
    this.scene.add(this.cloth);
  }

  private setupScene(): void {
    // We can remove the grid if not needed - kept for reference but moved further away
    const gridHelper = new THREE.GridHelper(200, 20, 0x555555, 0x333333);
    gridHelper.position.z = -50; // Moved behind the cloth
    gridHelper.position.y = -50; // Moved down
    this.scene.add(gridHelper);
  }

  // Just render once for the initial static state
  private renderStaticScene(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private setupScrollListener(): void {
    window.addEventListener('scroll', this.handleScroll);
  }

  private handleScroll = (): void => {
    const currentScrollY = window.scrollY;
    this.scrollVelocity = currentScrollY - this.previousScrollY;

    // Clamp the velocity to prevent extreme values
    this.scrollVelocity = Math.max(
      -this.maxScrollVelocity,
      Math.min(this.maxScrollVelocity, this.scrollVelocity)
    );

    // Only apply significant wind if velocity exceeds threshold
    if (Math.abs(this.scrollVelocity) > 1) {
      // Amplify the effect for more dramatic response
      const scaledVelocity = this.scrollVelocity * 0.15;

      // For a banner, we store wind force in y but apply it to z in the simulation
      gsap.to(this.windForce, {
        y: scaledVelocity,
        duration: 0.2,
        ease: 'power1.out',
      });

      // Start animation if not already running
      if (!this.isSimulationActive) {
        this.isSimulationActive = true;
        this.animate();
      }
    }

    this.previousScrollY = currentScrollY;

    // Clear any existing timeout
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
    }

    // Set timeout to reset the fabric after scrolling stops
    this.resetTimeout = setTimeout(() => {
      this.resetFabric();
    }, 500); // 500ms after scrolling stops
  };

  private resetFabric(): void {
    // Gradually reduce wind force to zero
    gsap.to(this.windForce, {
      x: 0,
      y: 0,
      z: 0,
      duration: 1.2, // Longer for more natural settling
      ease: 'power2.out',
    });

    // Let the simulation continue to allow the banner to settle naturally
    // with gravity and tension forces

    // Clear any existing reset timeout
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
    }

    // Check stability after a longer delay to allow natural settling
    this.resetTimeout = setTimeout(() => {
      if (this.isClothStable()) {
        this.isSimulationActive = false;
        if (this.animationFrameId) {
          cancelAnimationFrame(this.animationFrameId);
          this.animationFrameId = null;
        }
      } else {
        // Check again later if still moving
        this.resetTimeout = setTimeout(() => this.resetFabric(), 500);
      }
    }, 1500);
  }

  private isClothStable(): boolean {
    const velocityThreshold = 0.01;
    const zMovementThreshold = 0.05;
    let isStable = true;

    // For a banner, we care mostly about z-movement and general velocity
    for (const particle of this.particles) {
      if (!particle.pinned) {
        // Calculate particle velocity
        const velocity = new THREE.Vector3()
          .subVectors(particle.position, particle.oldPosition)
          .length();

        // Calculate z-axis movement specifically
        const zVelocity = Math.abs(
          particle.position.z - particle.oldPosition.z
        );

        // Check if still moving too much, especially in z-direction
        if (velocity > velocityThreshold || zVelocity > zMovementThreshold) {
          isStable = false;
          break;
        }
      }
    }

    return isStable;
  }

  private updateClothGeometry(): void {
    const geometry = this.cloth.geometry as THREE.BufferGeometry;
    const positions = geometry.attributes['position'].array as Float32Array;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const idx = i * 3;

      positions[idx] = p.position.x;
      positions[idx + 1] = p.position.y;
      positions[idx + 2] = p.position.z;
    }

    geometry.attributes['position'].needsUpdate = true;
    geometry.computeVertexNormals();
  }

  private simulate(): void {
    // Constant gravity - always pulling downward
    const gravity = new THREE.Vector3(0, -0.2, 0);

    // Apply forces to particles
    for (const particle of this.particles) {
      if (!particle.pinned) {
        // Always apply gravity - this is constant for a hanging banner
        particle.addForce(gravity);

        // Apply wind force - wind should mostly push the banner in the z direction
        // (perpendicular to the plane of the banner)
        const windEffect = new THREE.Vector3(0, 0, this.windForce.y);
        particle.addForce(windEffect);

        // Add a gentle restoration force in z-axis to simulate fabric tension
        // This helps the banner return to its flat state when wind stops
        const flatteningForce = new THREE.Vector3(
          0,
          0,
          -particle.position.z * 0.02
        );
        particle.addForce(flatteningForce);

        // Update position based on verlet integration with fixed timestep
        const newPos = new THREE.Vector3()
          .addVectors(
            particle.position,
            particle.position
              .clone()
              .sub(particle.oldPosition)
              .multiplyScalar(this.DRAG)
          )
          .add(
            particle.acceleration
              .clone()
              .multiplyScalar(this.timeStep * this.timeStep)
          );

        // Limit displacement to prevent simulation explosion
        const displacement = new THREE.Vector3().subVectors(
          newPos,
          particle.position
        );
        if (displacement.length() > this.MAX_DISPLACEMENT) {
          displacement.normalize().multiplyScalar(this.MAX_DISPLACEMENT);
          newPos.copy(particle.position).add(displacement);
        }

        particle.oldPosition.copy(particle.position);
        particle.position.copy(newPos);
        particle.acceleration.set(0, 0, 0);
      }
    }

    // Satisfy constraints with multiple iterations for stability
    const numIterations = 5;
    for (let i = 0; i < numIterations; i++) {
      for (const constraint of this.constraints) {
        constraint.satisfy();
      }
    }

    // Check for simulation explosion
    if (this.checkSimulationExploded()) {
      this.fullReset();
      return;
    }

    // Update cloth geometry
    this.updateClothGeometry();
  }

  private checkSimulationExploded(): boolean {
    // Check if any particle has moved too far or has NaN values
    for (const particle of this.particles) {
      if (
        isNaN(particle.position.x) ||
        isNaN(particle.position.y) ||
        isNaN(particle.position.z) ||
        Math.abs(particle.position.x) > 1000 ||
        Math.abs(particle.position.y) > 1000 ||
        Math.abs(particle.position.z) > 1000
      ) {
        console.warn('Simulation exploded! Resetting cloth...');
        return true;
      }
    }
    return false;
  }

  private fullReset(): void {
    // Remove the old cloth
    this.scene.remove(this.cloth);

    // Create a new cloth
    this.createCloth();

    // Reset wind force
    this.windForce.set(0, 0, 0);

    // Render once
    this.renderStaticScene();

    // Stop animation
    this.isSimulationActive = false;
  }

  private animate = (): void => {
    // Only continue animation if simulation is active
    if (!this.isSimulationActive) return;

    this.ngZone.runOutsideAngular(() => {
      this.simulate();
      this.renderer.render(this.scene, this.camera);
      this.animationFrameId = requestAnimationFrame(this.animate);
    });
  };

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    // Re-render if not animating
    if (!this.isSimulationActive) {
      this.renderStaticScene();
    }
  }

  private index(u: number, v: number): number {
    return u + v * (this.segmentsW + 1);
  }
}

// Helper classes for physics simulation
class Particle {
  oldPosition: THREE.Vector3;
  acceleration: THREE.Vector3;
  pinned: boolean;

  constructor(public position: THREE.Vector3, public mass: number) {
    this.oldPosition = position.clone();
    this.acceleration = new THREE.Vector3(0, 0, 0);
    this.pinned = false;
  }

  addForce(force: THREE.Vector3): void {
    const acc = force.clone().divideScalar(this.mass);
    if (!isNaN(acc.x) && !isNaN(acc.y) && !isNaN(acc.z)) {
      this.acceleration.add(acc);
    }
  }
}

class Constraint {
  constructor(
    private p1: Particle,
    private p2: Particle,
    private distance: number
  ) {}

  satisfy(): void {
    const p1p2 = new THREE.Vector3().subVectors(
      this.p2.position,
      this.p1.position
    );
    const currentDist = p1p2.length();

    if (currentDist === 0 || isNaN(currentDist)) return;

    // Calculate the correction vector
    const correction = p1p2
      .clone()
      .multiplyScalar(1 - this.distance / currentDist);
    const correctionHalf = correction.clone().multiplyScalar(0.5);

    // Apply corrections, with pinning check
    if (!this.p1.pinned) {
      this.p1.position.add(correctionHalf);
    }

    if (!this.p2.pinned) {
      this.p2.position.sub(correctionHalf);
    }
  }
}

@Component({
  selector: 'app-fabric-host',
  standalone: true,
  imports: [FabricSimulationComponent],
  template: `
    <div class="scroll-container">
      <header class="header">
        <h1>Fabric Simulation</h1>
        <p>Scroll to see the fabric react to wind</p>
      </header>

      <app-fabric-simulation></app-fabric-simulation>

      <div class="content">
        <section *ngFor="let i of [1, 2, 3, 4, 5]">
          <h2>Section {{ i }}</h2>
          <p>
            Scroll up and down to see the fabric respond to your scrolling
            velocity.
          </p>
          <p>
            The fabric reacts as if wind is blowing against it based on how fast
            you scroll.
          </p>
        </section>
      </div>
    </div>
  `,
  styles: [
    `
      .scroll-container {
        height: 300vh;
      }

      .header {
        height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        position: relative;
        z-index: 10;
        color: white;
        text-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
      }

      .content {
        padding: 2rem;
      }

      section {
        min-height: 50vh;
        margin-bottom: 2rem;
        padding: 2rem;
        background-color: rgba(255, 255, 255, 0.9);
        border-radius: 8px;
      }

      app-fabric-simulation {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100vh;
        z-index: 0;
      }
    `,
  ],
})
export class FabricHost {
  // Empty component
}
