import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as THREE from 'three';

@Component({
  selector: 'app-ferrofluid-sphere',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="controls">
        <div class="distortion-value">
          Distortion: {{ distortionValue.toFixed(2) }}
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          [(ngModel)]="distortionValue"
          (input)="updateDistortion()"
        />
        <button (click)="toggleWireframe()">Toggle Wireframe</button>
      </div>
      <div class="canvas-container">
        <canvas #renderCanvas></canvas>
      </div>
    </div>
  `,
  styles: [
    `
      .container {
        width: 100%;
        height: 100vh;
        display: flex;
        flex-direction: column;
        background-color: #1a1a1a;
      }
      .controls {
        padding: 16px;
        background: #2a2a2a;
        color: white;
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .distortion-value {
        min-width: 120px;
      }
      input[type='range'] {
        flex: 1;
      }
      button {
        padding: 8px 16px;
        background: #444;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      button:hover {
        background: #555;
      }
      .canvas-container {
        flex: 1;
        overflow: hidden;
      }
      canvas {
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class FerrofluidSphereComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  @ViewChild('renderCanvas') private canvasRef: ElementRef;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private sphere: THREE.Mesh;
  private originalPositions: Float32Array;
  private clock: THREE.Clock;
  private frameId: number = 0;
  private wireframe = false;

  // Control variables
  public distortionValue = 0;
  private spikes: THREE.Vector3[] = [];

  constructor() {
    gsap.registerPlugin(ScrollTrigger);
  }

  ngOnInit() {
    this.clock = new THREE.Clock();

    // Create magnetic spikes positions
    this.generateSpikePositions();
  }

  ngAfterViewInit() {
    this.createScene();
    this.startRenderingLoop();
    this.setupScrollTrigger();
  }

  ngOnDestroy() {
    if (this.frameId != null) {
      cancelAnimationFrame(this.frameId);
    }

    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());

    if (this.sphere) {
      this.sphere.geometry.dispose();
      (this.sphere.material as THREE.Material).dispose();
    }

    this.renderer?.dispose();
  }

  private generateSpikePositions() {
    // Generate spike positions (directed outward from sphere)
    this.spikes = [];

    // Create 8 well-distributed spikes
    const positions = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0.7, 0.7, 0),
      new THREE.Vector3(-0.7, 0.7, 0),
    ];

    for (const pos of positions) {
      this.spikes.push(pos.normalize());
    }
  }

  private createScene() {
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);

    // Camera setup
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.z = 2.5;

    // Create sphere with high polygon count for smooth distortions
    const geometry = new THREE.IcosahedronGeometry(1, 32);

    // Store original vertex positions
    this.originalPositions = new Float32Array(
      // @ts-ignore
      geometry.attributes.position.array
    );

    // Create material
    const material = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.9,
      roughness: 0.1,
      wireframe: this.wireframe,
    });

    this.sphere = new THREE.Mesh(geometry, material);
    this.scene.add(this.sphere);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0xffffff, 1);
    pointLight1.position.set(5, 3, 5);
    this.scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x8866ff, 1);
    pointLight2.position.set(-5, -3, 2);
    this.scene.add(pointLight2);

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvasRef.nativeElement,
      antialias: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Handle window resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  private applyDistortion() {
    if (!this.sphere) return;

    // @ts-ignore
    const positions = this.sphere.geometry.attributes.position
      .array as Float32Array;
    const time = this.clock.getElapsedTime();

    // Reset all vertices to their original position
    for (let i = 0; i < positions.length; i++) {
      positions[i] = this.originalPositions[i];
    }

    // Only apply distortion if value > 0
    if (this.distortionValue > 0) {
      // For each vertex in the geometry
      for (let i = 0; i < positions.length; i += 3) {
        const vertexPosition = new THREE.Vector3(
          positions[i],
          positions[i + 1],
          positions[i + 2]
        );

        // Calculate normalized direction vector (from center to vertex)
        const direction = vertexPosition.clone().normalize();

        // Clear distortion amount for this vertex
        let totalDistortion = 0;

        // For each spike, calculate influence on this vertex
        for (let j = 0; j < this.spikes.length; j++) {
          const spike = this.spikes[j];

          // Calculate dot product to find how aligned the vertex is with the spike
          // 1 = perfectly aligned, 0 = perpendicular, -1 = opposite
          const alignment = direction.dot(spike);

          // Only affect vertices that are somewhat aligned with the spike
          if (alignment > 0.7) {
            // Apply stronger distortion to more aligned vertices
            // Raise to power to create sharper falloff
            const distortionFactor = Math.pow(alignment, 8) * 1.5;

            // Add time-based pulsation to make it more dynamic
            const pulseFactor = 0.2 * Math.sin(time * 2 + j) + 1;

            // Add to total distortion
            totalDistortion += distortionFactor * pulseFactor;
          }
        }

        // Apply the accumulated distortion
        const distortionAmount = totalDistortion * this.distortionValue;
        positions[i] += direction.x * distortionAmount;
        positions[i + 1] += direction.y * distortionAmount;
        positions[i + 2] += direction.z * distortionAmount;
      }
    }

    // Mark the attribute for update
    // @ts-ignore
    this.sphere.geometry.attributes.position.needsUpdate = true;

    // Recompute normals for proper lighting
    this.sphere.geometry.computeVertexNormals();
  }

  private startRenderingLoop() {
    const component = this;

    function render() {
      component.applyDistortion();

      // Rotate sphere slightly to show all sides
      component.sphere.rotation.y += 0.005;
      component.sphere.rotation.x += 0.002;

      component.renderer.render(component.scene, component.camera);
      component.frameId = requestAnimationFrame(render);
    }

    render();
  }

  private setupScrollTrigger() {
    // Use GSAP ScrollTrigger to control distortion
    gsap.to(this, {
      distortionValue: 1,
      duration: 1,
      scrollTrigger: {
        trigger: document.body,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
      },
    });
  }

  // UI Control methods
  public updateDistortion() {
    // This will be called when slider changes
    this.applyDistortion();
  }

  public toggleWireframe() {
    this.wireframe = !this.wireframe;
    (this.sphere.material as THREE.MeshStandardMaterial).wireframe =
      this.wireframe;
  }
}
