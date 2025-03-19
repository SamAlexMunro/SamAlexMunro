// fading-displacement.component.ts
import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import * as THREE from 'three';

// Interface for image pair configuration
export interface ImagePair {
  id: string;
  image1: string; // First image path
  image2: string; // Second image path
  width?: number; // Optional custom width
  height?: number; // Optional custom height
}

@Component({
  selector: 'app-fading-displacement',
  standalone: true,
  imports: [CommonModule],
  template: `<div #container class="three-container"></div>`,
  styles: [
    `
      .three-container {
        width: 100%;
        height: 100%;
        position: relative;
      }
    `,
  ],
})
export class FadingDisplacementComponent implements OnInit, OnDestroy {
  @ViewChild('container', { static: true }) containerRef!: ElementRef;

  // Container dimensions
  @Input() width = window.innerWidth - 40;
  @Input() height = window.innerHeight;

  // Effect settings
  @Input() effectIntensity = 0.4;
  @Input() gapSize = 20; // Gap between images
  @Input() itemsPerRow = 3; // Default number of items per row

  // Array of image pairs to display
  @Input() imagePairs: ImagePair[] = [
    {
      id: 'default1',
      image1: 'react.png',
      image2: 'background-displacement.png',
      width: 300,
      height: 200,
    },
  ];

  // Shared displacement map for all meshes
  @Input() displacementMap = 'displacement.jpg';

  // Three.js variables
  private scene!: THREE.Scene;
  private camera!: THREE.OrthographicCamera; // Using orthographic camera for 2D layout
  private renderer!: THREE.WebGLRenderer;
  private meshes: THREE.Mesh[] = [];
  private materials: THREE.ShaderMaterial[] = [];
  private animationFrameId!: number;
  private hoveredMeshIndex: number = -1;
  private dispFactors: number[] = [];

  // Cache DOM element for event listeners
  private rendererDomElement!: HTMLCanvasElement;

  // Track mouse position for hover detection
  private mouse = new THREE.Vector2();
  private raycaster = new THREE.Raycaster();

  // Optimized shader code
  private static readonly vertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  private static readonly fragmentShader = `
    varying vec2 vUv;
    uniform sampler2D tex;
    uniform sampler2D tex2;
    uniform sampler2D disp;
    uniform float dispFactor;
    uniform float effectFactor;

    void main() {
        // Get displacement map value
        vec4 disp = texture2D(disp, vUv);

        // Calculate center distance for edge falloff
        vec2 center = vec2(0.5);
        float distanceFromCenter = distance(vUv, center);
        vec2 direction = normalize(vUv - center);

        // Calculate falloff to reduce displacement at edges
        float edgeFalloff = 1.0 - smoothstep(0.3, 0.5, distanceFromCenter);
        float displaceAmount = disp.r * effectFactor * 0.75 * edgeFalloff;

        // Calculate offset positions for both textures
        vec2 distortedPosition = vUv - direction * displaceAmount * dispFactor;
        vec2 distortedPosition2 = vUv - direction * displaceAmount * (1.0 - dispFactor);

        // Sample textures with the displaced coordinates
        vec4 _texture = texture2D(tex, distortedPosition);
        vec4 _texture2 = texture2D(tex2, distortedPosition2);

        // Mix between the two textures based on displacement factor
        gl_FragColor = mix(_texture, _texture2, dispFactor);
    }
  `;

  // Bound event handlers
  private readonly handleMouseMove = (event: MouseEvent): void => {
    // Calculate mouse position in normalized device coordinates (-1 to +1)
    const rect = this.rendererDomElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Update raycaster and check for intersections
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.meshes);

    // Reset all hover states
    const previousHovered = this.hoveredMeshIndex;
    this.hoveredMeshIndex = -1;

    // Set hover state for intersected mesh
    if (intersects.length > 0) {
      // Find index of the intersected mesh
      const intersectedMesh = intersects[0].object;
      const index = this.meshes.findIndex(
        (mesh) => mesh.uuid === intersectedMesh.uuid
      );
      if (index !== -1) {
        this.hoveredMeshIndex = index;
      }
    }

    // Only force render if hover state changed (performance optimization)
    if (previousHovered !== this.hoveredMeshIndex) {
      this.render();
    }
  };

  // Window resize handler
  private readonly handleResize = (): void => {
    if (!this.renderer) return;

    this.width = window.innerWidth - 40;
    this.height = window.innerHeight;

    // Update renderer
    this.renderer.setSize(this.width, this.height);

    // Recalculate layout
    this.updateGridLayout();
  };

  constructor() {}

  ngOnInit(): void {
    this.initThree();
    this.setupEventListeners();
    this.startAnimation();
  }

  ngOnDestroy(): void {
    this.cleanupResources();
  }

  private initThree(): void {
    // Create scene
    this.scene = new THREE.Scene();

    // Use orthographic camera for 2D grid layout
    this.camera = new THREE.OrthographicCamera(
      this.width / -2,
      this.width / 2,
      this.height / 2,
      this.height / -2,
      0.1,
      1000
    );
    this.camera.position.z = 5;

    // Setup renderer with transparency
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.rendererDomElement = this.renderer.domElement;
    this.containerRef.nativeElement.appendChild(this.rendererDomElement);

    // Load shared displacement map
    const textureLoader = new THREE.TextureLoader();
    const dispTexture = textureLoader.load(this.displacementMap);
    dispTexture.wrapS = dispTexture.wrapT = THREE.RepeatWrapping;

    // Create meshes for each image pair
    this.createMeshes(dispTexture);

    // Position meshes in a grid layout
    this.updateGridLayout();
  }

  private createMeshes(dispTexture: THREE.Texture): void {
    const textureLoader = new THREE.TextureLoader();

    // Clear existing meshes
    this.meshes.forEach((mesh) => {
      this.scene.remove(mesh);
      (mesh.geometry as THREE.BufferGeometry).dispose();
    });
    this.materials.forEach((material) => material.dispose());

    this.meshes = [];
    this.materials = [];
    this.dispFactors = [];

    // Create a mesh for each image pair
    this.imagePairs.forEach((pair, index) => {
      // Load textures
      const texture1 = textureLoader.load(pair.image1);
      const texture2 = textureLoader.load(pair.image2);

      // Set texture properties
      [texture1, texture2].forEach((texture) => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.minFilter = THREE.LinearFilter;
      });

      // Create material
      const material = new THREE.ShaderMaterial({
        uniforms: {
          effectFactor: { value: this.effectIntensity },
          dispFactor: { value: 0 },
          tex: { value: texture1 },
          tex2: { value: texture2 },
          disp: { value: dispTexture },
        },
        vertexShader: FadingDisplacementComponent.vertexShader,
        fragmentShader: FadingDisplacementComponent.fragmentShader,
        transparent: true,
        toneMapped: false,
      });

      // Get dimensions for this image pair (use defaults if not specified)
      const itemWidth = pair.width || 300;
      const itemHeight = pair.height || 200;

      // Create geometry and mesh
      const geometry = new THREE.PlaneGeometry(itemWidth, itemHeight);
      const mesh = new THREE.Mesh(geometry, material);
      // @ts-ignore
      mesh.userData.index = index; // Store index for easy identification

      // Add to scene and tracking arrays
      this.scene.add(mesh);
      this.meshes.push(mesh);
      this.materials.push(material);
      this.dispFactors.push(0);
    });
  }

  private updateGridLayout(): void {
    if (!this.meshes.length) return;

    // Calculate total available width and number of items per row
    const containerWidth = this.width;
    const itemsPerRow = Math.min(this.itemsPerRow, this.meshes.length);

    // Calculate total row width including gaps
    let totalWidth = 0;
    for (let i = 0; i < Math.min(itemsPerRow, this.meshes.length); i++) {
      const mesh = this.meshes[i];
      // @ts-ignore
      totalWidth += mesh.geometry.parameters.width;
      if (i < itemsPerRow - 1) totalWidth += this.gapSize;
    }

    // Position each mesh in a grid layout
    let currentRow = 0;
    let currentCol = 0;
    let rowHeight = 0;
    let startX = -containerWidth / 2 + (containerWidth - totalWidth) / 2;
    let currentX = startX;
    let currentY = this.height / 2 - 100; // Start from top with some margin

    this.meshes.forEach((mesh, index) => {
      // @ts-ignore
      const width = mesh.geometry.parameters.width;
      // @ts-ignore
      const height = mesh.geometry.parameters.height;

      // Update row height (find tallest element in current row)
      rowHeight = Math.max(rowHeight, height);

      // Position mesh
      mesh.position.x = currentX + width / 2;
      mesh.position.y = currentY - height / 2;
      mesh.position.z = 0;

      // Move to next column
      currentX += width + this.gapSize;
      currentCol++;

      // Move to next row if needed
      if (currentCol >= itemsPerRow && index < this.meshes.length - 1) {
        currentRow++;
        currentCol = 0;
        currentX = startX;
        currentY -= rowHeight + this.gapSize;
        rowHeight = 0;
      }
    });

    // Update camera to frame the grid properly
    this.adjustCameraToFitContent();
  }

  private adjustCameraToFitContent(): void {
    // Find bounding box of all meshes
    const boundingBox = new THREE.Box3();
    this.meshes.forEach((mesh) => boundingBox.expandByObject(mesh));

    // Calculate center and size
    const center = new THREE.Vector3();
    boundingBox.getCenter(center);
    const size = new THREE.Vector3();
    boundingBox.getSize(size);

    // Add margin to size
    const margin = 50;
    size.x += margin * 2;
    size.y += margin * 2;

    // Update orthographic camera
    this.camera.left = -this.width / 2;
    this.camera.right = this.width / 2;
    this.camera.top = this.height / 2;
    this.camera.bottom = -this.height / 2;
    this.camera.position.x = center.x;
    this.camera.position.y = center.y;
    this.camera.updateProjectionMatrix();
  }

  private startAnimation(): void {
    // Begin the animation loop
    const animate = (): void => {
      this.animationFrameId = requestAnimationFrame(animate);

      // Update dispFactors with smooth lerp
      this.dispFactors.forEach((factor, index) => {
        this.dispFactors[index] = THREE.MathUtils.lerp(
          factor,
          this.hoveredMeshIndex === index ? 1 : 0,
          0.055
        );

        // Update material uniform
        this.materials[index].uniforms['dispFactor'].value =
          this.dispFactors[index];
      });

      this.render();
    };

    animate();
  }

  private render(): void {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private setupEventListeners(): void {
    // Add event listeners
    this.rendererDomElement.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('resize', this.handleResize);
  }

  private cleanupResources(): void {
    // Cancel animation frame
    cancelAnimationFrame(this.animationFrameId);

    // Remove event listeners
    this.rendererDomElement.removeEventListener(
      'mousemove',
      this.handleMouseMove
    );
    window.removeEventListener('resize', this.handleResize);

    // Dispose of Three.js resources
    this.renderer.dispose();
    this.meshes.forEach((mesh) => {
      (mesh.geometry as THREE.BufferGeometry).dispose();
    });
    this.materials.forEach((material) => {
      material.dispose();
    });

    // Clear scene
    this.scene.clear();
  }
}
