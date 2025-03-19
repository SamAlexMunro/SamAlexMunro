import { Component, ElementRef, ViewChild } from '@angular/core';
import { gsap } from 'gsap';
import * as THREE from 'three';

@Component({
  selector: 'app-fabric',
  standalone: true,
  imports: [],
  template: '<div #rendererContainer></div>',
  styles: ['div { width: 100vw; height: 100vh; }'],
})
export class FabricComponent {
  @ViewChild('rendererContainer') rendererContainer!: ElementRef;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private mesh!: THREE.Mesh;
  private originalVertices!: Float32Array; // Store initial vertex positions

  ngAfterViewInit() {
    this.initScene();
    this.createFabricMesh();
    this.addEventListeners();
    this.animate();
  }

  private initScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera['position'].z = 5;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.rendererContainer.nativeElement.appendChild(this.renderer.domElement);
  }

  private createFabricMesh() {
    const geometry = new THREE.PlaneGeometry(5, 5, 32, 32);
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load('robot.png'); // Ensure path is correct

    // Log texture loading issues
    textureLoader.load(
      '/assets/robot.png',
      (tex) => console.log('Texture loaded successfully'),
      undefined,
      (err) => console.error('Error loading texture:', err)
    );

    const material = new THREE.MeshPhongMaterial({
      map: texture,
      side: THREE.DoubleSide,
      shininess: 10,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.mesh);

    // Store original vertices for resetting
    // @ts-ignore
    this.originalVertices =
      this.mesh.geometry.attributes['position'].array.slice();

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light['position'].set(0, 1, 1).normalize();
    this.scene.add(light);
  }

  private addEventListeners() {
    window.addEventListener('wheel', (event) => this.onScroll(event));
  }

  private onScroll(event: WheelEvent) {
    const scrollDelta = event.deltaY * 0.01; // Increased sensitivity
    this.animateFabric(scrollDelta);
  }

  private animateFabric(scrollDelta: number) {
    const vertices = this.mesh.geometry.attributes['position']
      .array as Float32Array;

    // Apply deformation
    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i];
      const y = vertices[i + 1];
      const z = this.originalVertices[i + 2]; // Start from original z

      const wave = Math.sin(x + scrollDelta) * Math.cos(y + scrollDelta) * 0.5;
      vertices[i + 2] = z + wave;
    }

    this.mesh.geometry.attributes['position'].needsUpdate = true;

    // Smoothly reset to original positions with GSAP
    gsap.to(vertices, {
      duration: 1,
      ease: 'power2.out',
      // @ts-ignore
      endArray: this.originalVertices.slice(), // Reset to original positions
      onUpdate: () => {
        this.mesh.geometry.attributes['position'].needsUpdate = true;
      },
    });
  }

  private animate() {
    requestAnimationFrame(() => this.animate());
    this.renderer.render(this.scene, this.camera);
  }
}
