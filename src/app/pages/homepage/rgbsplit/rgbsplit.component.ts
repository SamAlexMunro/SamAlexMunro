import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import * as THREE from 'three';

// In an Angular project, you'd likely put these in separate files
const vertexShader = `
  uniform sampler2D uTexture;
  uniform vec2 uOffset;
  varying vec2 vUv;

  #define M_PI 3.1415926535897932384626433832795

  vec3 deformationCurve(vec3 position, vec2 uv, vec2 offset) {
    position.x = position.x + (sin(uv.y * M_PI) * offset.x);
    position.y = position.y + (sin(uv.x * M_PI) * offset.y);
    return position;
  }

  void main() {
    vUv = uv;
    vec3 newPosition = deformationCurve(position, uv, uOffset);
    gl_Position = projectionMatrix * modelViewMatrix * vec4( newPosition, 1.0 );
  }
`;

const fragmentShader = `
  uniform sampler2D uTexture;
  uniform float uAlpha;
  uniform vec2 uOffset;
  varying vec2 vUv;

  vec4 rgbShift(sampler2D textureImage, vec2 uv, vec2 offset) {
    // Sample each channel with different offsets for stronger effect
    float r = texture2D(textureImage, uv + offset * 1.0).r;
    float g = texture2D(textureImage, uv).g;
    float b = texture2D(textureImage, uv - offset * 0.5).b;

    // Get alpha from the center sample to maintain proper shape
    float a = texture2D(textureImage, uv).a;

    return vec4(r, g, b, a);
  }

  void main() {
    vec4 color = rgbShift(uTexture, vUv, uOffset);

    // Only apply chromatic aberration where there's visible content
    gl_FragColor = vec4(color.rgb, color.a * uAlpha);
  }
`;

@Component({
  selector: 'app-smooth-scroll',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rgbsplit.component.html',
  styleUrl: './rgbsplit.component.scss',
  template: `
    <main #container>
      <div class="scrollable" #scrollable>
        <div class="container">
          <div class="image-container">
            <img alt src="css.png" />
            <img alt src="js.png" />
            <img alt src="react-native.svg" />
            <img alt src="react.png" />
            <img alt src="scss.png" />
          </div>
        </div>
      </div>
    </main>
  `,
})
export class SmoothScrollComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('container', { static: true }) container!: ElementRef<HTMLElement>;
  @ViewChild('scrollable', { static: true })
  scrollable!: ElementRef<HTMLElement>;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private meshItems: MeshItem[] = [];
  private animationFrameId: number = 0;

  private current: number = 0;
  private target: number = 0;
  private ease: number = 0.075;

  constructor() {}

  ngOnInit(): void {
    // Initial setup
    this.initBodyHeight();
  }

  ngAfterViewInit(): void {
    // Setup Three.js after the view is initialized
    this.setupCamera();
    this.createMeshItems();
    this.render();
  }

  ngOnDestroy(): void {
    // Clean up resources when component is destroyed
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.scene.clear();
    this.renderer.dispose();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.initBodyHeight();
    this.updateCamera();
  }

  @HostListener('window:scroll')
  onScroll(): void {
    // Update target on scroll
    this.target = window.scrollY;
  }

  private initBodyHeight(): void {
    // Set the body height to enable scrolling
    document.body.style.height = `${
      this.scrollable.nativeElement.getBoundingClientRect().height
    }px`;
  }

  private setupCamera(): void {
    // Create new scene
    this.scene = new THREE.Scene();

    // Initialize perspective camera
    const perspective = 1000;
    const fov =
      (180 * (2 * Math.atan(window.innerHeight / 2 / perspective))) / Math.PI;
    this.camera = new THREE.PerspectiveCamera(
      fov,
      this.viewport.aspectRatio,
      1,
      1000
    );
    this.camera.position.set(0, 0, perspective);

    // Initialize renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(this.viewport.width, this.viewport.height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.nativeElement.appendChild(this.renderer.domElement);
  }

  private updateCamera(): void {
    this.camera.aspect = this.viewport.aspectRatio;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.viewport.width, this.viewport.height);
  }

  private createMeshItems(): void {
    // Find all images within the scrollable container
    const images = Array.from(
      this.scrollable.nativeElement.querySelectorAll('img')
    );

    // Create mesh items for each image
    images.forEach((image) => {
      const meshItem = new MeshItem(image, this.scene);
      this.meshItems.push(meshItem);
    });
  }

  private smoothScroll(): void {
    this.current = this.lerp(this.current, this.target, this.ease);
  }

  private render = (): void => {
    // Smooth scroll and update meshes
    this.smoothScroll();

    // Update each mesh item
    for (let i = 0; i < this.meshItems.length; i++) {
      this.meshItems[i].render(this.target, this.current);
    }

    // Render the scene
    this.renderer.render(this.scene, this.camera);

    // Continue animation loop
    this.animationFrameId = requestAnimationFrame(this.render);
  };

  private lerp(start: number, end: number, t: number): number {
    // Linear interpolation helper
    return start * (1 - t) + end * t;
  }

  // Getter for viewport dimensions
  private get viewport() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspectRatio = width / height;
    return {
      width,
      height,
      aspectRatio,
    };
  }
}

// Helper class for mesh creation and management
class MeshItem {
  private element: HTMLImageElement;
  private scene: THREE.Scene;
  private mesh: THREE.Mesh;
  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  private imageTexture: THREE.Texture;
  private uniforms: any;
  private offset: THREE.Vector2;
  private sizes: THREE.Vector2;

  constructor(element: HTMLImageElement, scene: THREE.Scene) {
    this.element = element;
    this.scene = scene;
    this.offset = new THREE.Vector2(0, 0);
    this.sizes = new THREE.Vector2(0, 0);
    this.createMesh();
  }

  private getDimensions(): void {
    const { width, height, top, left } = this.element.getBoundingClientRect();
    this.sizes.set(width, height);
    this.offset.set(
      left - window.innerWidth / 2 + width / 2,
      -top + window.innerHeight / 2 - height / 2
    );
  }

  private createMesh(): void {
    // Create geometry with higher resolution for more detailed distortion
    this.geometry = new THREE.PlaneGeometry(1, 1, 100, 100);

    // Load texture
    this.imageTexture = new THREE.TextureLoader().load(this.element.src);
    // Set texture parameters for better quality
    this.imageTexture.minFilter = THREE.LinearFilter;
    this.imageTexture.magFilter = THREE.LinearFilter;
    this.imageTexture.generateMipmaps = false;
    this.imageTexture.format = THREE.RGBAFormat; // Explicitly set RGBA format

    // Setup uniforms for shaders
    this.uniforms = {
      uTexture: {
        value: this.imageTexture,
      },
      uOffset: {
        value: new THREE.Vector2(0.0, 0.0),
      },
      uAlpha: {
        value: 1.0,
      },
      // uDistortionIntensity: {
      //   value: 0.5, // Configurable distortion intensity
      // },
    };

    // Create material with shaders
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false, // Add this line to prevent transparency sorting issues
      blending: THREE.NormalBlending, // Ensure normal blending mode
    });
    // Create mesh and add to scene
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.getDimensions();
    this.mesh.position.set(this.offset.x, this.offset.y, 0);
    this.mesh.scale.set(this.sizes.x, this.sizes.y, 1);
    this.scene.add(this.mesh);
  }

  public render(target: number, current: number): void {
    // Update dimensions and position
    this.getDimensions();
    this.mesh.position.set(this.offset.x, this.offset.y, 0);
    this.mesh.scale.set(this.sizes.x, this.sizes.y, 1);

    // Calculate scroll velocity for distortion effects
    const scrollVelocity = -(target - current) * 0.003;

    // Update shader uniforms
    this.uniforms.uOffset.value.set(this.offset.x * 0.0, scrollVelocity);
  }
}
