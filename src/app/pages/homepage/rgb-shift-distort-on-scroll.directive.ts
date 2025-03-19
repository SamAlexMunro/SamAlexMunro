// shader-effect.directive.ts
import { DOCUMENT } from '@angular/common';
import {
  AfterViewInit,
  Directive,
  ElementRef,
  Inject,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  Renderer2,
} from '@angular/core';
import * as THREE from 'three';

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

// Available shader effects
export enum ShaderEffectType {
  CHROMATIC_ABERRATION = 'chromatic_aberration',
  DISTORTION = 'distortion',
  PIXELATE = 'pixelate',
  WAVE = 'wave',
  RGB_SHIFT = 'rgb_shift',
}

// Shader code
const SHADER_LIBRARY = {
  // Vertex shaders
  vertex: {
    distortion: `
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
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
      }
    `,
    wave: `
      uniform float uTime;
      uniform float uFrequency;
      uniform float uAmplitude;
      varying vec2 vUv;

      void main() {
        vUv = uv;
        vec3 pos = position;

        // Apply wave effect
        float displacement = sin(uFrequency * position.x + uTime) * uAmplitude;
        pos.y += displacement;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    basic: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  },

  // Fragment shaders
  fragment: {
    rgbShift: `
      uniform sampler2D uTexture;
      uniform float uAlpha;
      uniform vec2 uOffset;
      varying vec2 vUv;

      vec4 rgbShift(sampler2D textureImage, vec2 uv, vec2 offset) {
        // Sample each channel with different offsets
        float r = texture2D(textureImage, uv + offset * 1.0).r;
        float g = texture2D(textureImage, uv).g;
        float b = texture2D(textureImage, uv - offset * 0.5).b;

        // Get alpha from the center sample
        float a = texture2D(textureImage, uv).a;

        return vec4(r, g, b, a);
      }

      void main() {
        vec4 color = rgbShift(uTexture, vUv, uOffset);
        gl_FragColor = vec4(color.rgb, color.a * uAlpha);
      }
    `,
    pixelate: `
      uniform sampler2D uTexture;
      uniform float uAlpha;
      uniform vec2 uResolution;
      uniform float uPixelSize;
      varying vec2 vUv;

      void main() {
        vec2 pixelatedUV = floor(vUv * uResolution / uPixelSize) * uPixelSize / uResolution;
        vec4 color = texture2D(uTexture, pixelatedUV);
        gl_FragColor = vec4(color.rgb, color.a * uAlpha);
      }
    `,
    basic: `
      uniform sampler2D uTexture;
      uniform float uAlpha;
      varying vec2 vUv;

      void main() {
        vec4 color = texture2D(uTexture, vUv);
        gl_FragColor = vec4(color.rgb, color.a * uAlpha);
      }
    `,
  },
};

const scene = new THREE.Scene();

@Directive({
  selector: '[appShaderEffect]',
  standalone: true,
})
export class ShaderEffectDirective implements OnInit, AfterViewInit, OnDestroy {
  @Input() effectType: ShaderEffectType | string = ShaderEffectType.RGB_SHIFT;
  @Input() intensity: number = 0.5;
  @Input() scrollSensitivity: number = 0.003;
  @Input() animationSpeed: number = 1.0;

  private canvas: HTMLElement;
  private canvasContainer: HTMLElement | null = null;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private mesh!: THREE.Mesh;
  private uniforms: any;
  private animationFrameId: number | null = null;
  private scrollListener!: Function;
  private resizeListener!: Function;
  private targetScrollY: number = 0;
  private currentScrollY: number = 0;
  private ease: number = 0.075;
  private clock = new THREE.Clock();
  private composer: any;

  constructor(
    private el: ElementRef,
    private renderer2: Renderer2,
    private ngZone: NgZone,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    // Create canvas container if it doesn't exist
    this.createCanvasContainer();
  }

  ngAfterViewInit(): void {
    // Wait for the image to load before setting up the effect
    const img = this.el.nativeElement as HTMLImageElement;

    if (img.complete) {
      this.setupShaderEffect();
    } else {
      img.addEventListener('load', () => {
        this.setupShaderEffect();
      });
    }
  }

  ngOnDestroy(): void {
    console.log('destroy');
    // Clean up resources
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    if (this.scrollListener) {
      this.scrollListener();
    }

    if (this.resizeListener) {
      this.resizeListener();
    }

    // Dispose Three.js resources
    if (this.mesh) {
      scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      if (this.mesh.material instanceof THREE.Material) {
        this.mesh.material.dispose();
      }
    }

    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  private createCanvasContainer(): void {
    // Check if container already exists
    let container = this.document.getElementById('shader-effect-container');

    if (!container) {
      // Create a fixed container for all canvases
      container = this.renderer2.createElement('div');
      this.renderer2.setAttribute(container, 'id', 'shader-effect-container');
      this.renderer2.setStyle(container, 'position', 'fixed');
      this.renderer2.setStyle(container, 'top', '0');
      this.renderer2.setStyle(container, 'left', '0');
      this.renderer2.setStyle(container, 'width', '100%');
      this.renderer2.setStyle(container, 'height', '100%');
      this.renderer2.setStyle(container, 'pointer-events', 'none');
      this.renderer2.setStyle(container, 'z-index', '1001');

      this.renderer2.appendChild(this.document.body, container);
    }

    this.canvasContainer = container;
  }

  private setupShaderEffect(): void {
    // Create scene

    // Create camera
    const fov = 50;
    const aspectRatio = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(fov, aspectRatio, 0.1, 2000);
    this.camera.position.z = 1000;

    // Create canvas
    this.canvas = this.document.getElementsByTagName('canvas')[0];
    console.log(this.canvas);
    this.renderer2.setAttribute(
      this.canvas,
      'id',
      'shader-canvas-' + Math.random().toString(36).substr(2, 9)
    );

    // Create renderer with improved settings
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });

    // Configure renderer for best quality
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.composer = new EffectComposer(this.renderer);

    // RenderPass: Renders the scene normally
    const renderPass = new RenderPass(scene, this.camera);
    this.composer.addPass(renderPass);

    // FXAA Pass: Applies FXAA Anti-Aliasing
    const fxaaPass = new ShaderPass(FXAAShader);

    // Set resolution-dependent uniforms
    const pixelRatio = this.renderer.getPixelRatio();
    fxaaPass.uniforms['resolution'].value.x =
      1 / (window.innerWidth * pixelRatio);
    fxaaPass.uniforms['resolution'].value.y =
      1 / (window.innerHeight * pixelRatio);

    this.composer.addPass(fxaaPass);

    // Add canvas to container
    if (this.canvasContainer) {
      this.renderer2.appendChild(this.canvasContainer, this.canvas);
    }

    // Create mesh with shader material
    this.createMesh();

    // Set up event listeners
    this.setupEventListeners();

    // Start animation loop
    this.startAnimationLoop();
  }

  // Update the createMesh method for improved texture quality
  private createMesh(): void {
    const img = this.el.nativeElement as HTMLImageElement;

    // Create a higher resolution geometry for smoother distortion
    const geometry = new THREE.PlaneGeometry(1, 1, 8, 8); // Increased segments for smoother distortion

    // Load the image into a texture with improved settings
    const textureLoader = new THREE.TextureLoader();

    // Enable CORS if needed for cross-origin images
    textureLoader.crossOrigin = 'anonymous';

    const texture = textureLoader.load(img.src, (loadedTexture) => {
      loadedTexture.needsUpdate = true;
      loadedTexture.minFilter = THREE.LinearMipmapLinearFilter; // Enhanced filtering
      loadedTexture.magFilter = THREE.LinearFilter;

      // Enable anisotropic filtering with a softer approach
      const anisotropy = Math.min(
        this.renderer.capabilities.getMaxAnisotropy(),
        16
      );
      loadedTexture.anisotropy = anisotropy;

      this.updateMeshPosition();

      this.renderer.render(scene, this.camera);
    });

    // Improve texture filtering
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    // Enable anisotropic filtering for sharper textures at angles
    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
    texture.anisotropy = maxAnisotropy;

    // Disable mipmapping for sharper image
    texture.generateMipmaps = false;

    // Ensure proper format
    texture.format = THREE.RGBAFormat;

    // Set proper texture encoding for accurate colors
    texture.colorSpace = THREE.SRGBColorSpace;

    // Make sure premultiplied alpha is handled correctly
    texture.premultiplyAlpha = false;

    // Select shaders based on effect type
    const { vertexShader, fragmentShader } = this.getShaders();

    // Create uniforms
    this.uniforms = {
      uTexture: { value: texture },
      uAlpha: { value: 1.0 },
      uOffset: { value: new THREE.Vector2(0.0, 0.0) },
      uTime: { value: 0.0 },
      uResolution: {
        value: new THREE.Vector2(
          img.naturalWidth || img.width,
          img.naturalHeight || img.height
        ),
      },
      uPixelSize: { value: 8.0 },
      uFrequency: { value: 10.0 },
      uAmplitude: { value: 0.1 },
    };

    // Create material with improved quality settings
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false,
      precision: 'mediump', // High precision
      // Optional: Add antialiasing parameters
      defines: {
        GLSLIFY: 1,
      },
    });

    // Create mesh
    this.mesh = new THREE.Mesh(geometry, material);
    console.log(this.mesh);
    scene.add(this.mesh);

    // Position and scale the mesh to match the image
    this.updateMeshPosition();
  }

  private getShaders(): { vertexShader: string; fragmentShader: string } {
    let vertexShader = SHADER_LIBRARY.vertex.basic;
    let fragmentShader = SHADER_LIBRARY.fragment.basic;

    switch (this.effectType) {
      case ShaderEffectType.CHROMATIC_ABERRATION:
      case ShaderEffectType.RGB_SHIFT:
        vertexShader = SHADER_LIBRARY.vertex.distortion;
        fragmentShader = SHADER_LIBRARY.fragment.rgbShift;
        break;
      case ShaderEffectType.DISTORTION:
        vertexShader = SHADER_LIBRARY.vertex.distortion;
        fragmentShader = SHADER_LIBRARY.fragment.basic;
        break;
      case ShaderEffectType.PIXELATE:
        vertexShader = SHADER_LIBRARY.vertex.basic;
        fragmentShader = SHADER_LIBRARY.fragment.pixelate;
        break;
      case ShaderEffectType.WAVE:
        vertexShader = SHADER_LIBRARY.vertex.wave;
        fragmentShader = SHADER_LIBRARY.fragment.basic;
        break;
    }

    return { vertexShader, fragmentShader };
  }

  private setupEventListeners(): void {
    this.ngZone.runOutsideAngular(() => {
      // Listen for scroll events
      this.scrollListener = this.renderer2.listen('window', 'scroll', () => {
        this.targetScrollY = window.scrollY;
      });

      // Listen for resize events
      this.resizeListener = this.renderer2.listen('window', 'resize', () => {
        this.onResize();
      });
    });
  }

  private onResize(): void {
    if (!this.renderer || !this.camera) return;

    // Update renderer size
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    // Update camera aspect ratio
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    // Update mesh position and size
    this.updateMeshPosition();
  }

  // Final fix for the updateMeshPosition method
  private updateMeshPosition(): void {
    if (!this.mesh) return;

    const img = this.el.nativeElement as HTMLImageElement;
    const rect = img.getBoundingClientRect();

    // Get the canvas element
    const canvas = this.document.getElementById('canvas');
    const canvasRect = canvas?.getBoundingClientRect() || {
      left: 0,
      top: 0,
      width: window.innerWidth,
      height: window.innerHeight,
    };

    // Calculate position relative to the canvas
    const canvasCenterX = canvasRect.left + canvasRect.width / 2;
    const canvasCenterY = canvasRect.top + canvasRect.height / 2;

    // Calculate the center position of the image
    const imageCenterX = rect.left + rect.width / 2;
    const imageCenterY = rect.top + rect.height / 2;

    // Calculate the offset from the canvas center
    const x = imageCenterX - canvasCenterX;

    // Y is inverted in Three.js compared to DOM
    const y = -(imageCenterY - canvasCenterY);

    // Get the WebGL viewport scaling
    // NOTE: This is the key fix - we need to account for THREE.js scaling of the coordinate space
    const frustumHeight =
      2 *
      Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) *
      this.camera.position.z;
    const frustumWidth = frustumHeight * this.camera.aspect;

    // Calculate scale factors to convert from pixel units to Three.js units
    const scaleX = frustumWidth / canvasRect.width;
    const scaleY = frustumHeight / canvasRect.height;

    // Apply scale to convert from pixel coordinates to Three.js coordinates
    const xWorld = x * scaleX;
    const yWorld = y * scaleY;

    // Position mesh in Three.js world space
    this.mesh.position.set(xWorld, yWorld, 0);

    // Scale mesh to match image dimensions in world space
    this.mesh.scale.set(rect.width * scaleX, rect.height * scaleY, 1);
  }

  private startAnimationLoop(): void {
    this.ngZone.runOutsideAngular(() => {
      this.animate();
    });
  }

  private lerp(start: number, end: number, t: number): number {
    return start * (1 - t) + end * t;
  }

  // Updated animate method to ensure no effect when not scrolling
  private animate = (): void => {
    // Calculate previous scroll position for velocity calculation
    const prevScrollY = this.currentScrollY;

    // Smooth scrolling
    this.currentScrollY = this.lerp(
      this.currentScrollY,
      this.targetScrollY,
      this.ease
    );

    // Calculate scroll velocity - the difference between current and previous positions
    const scrollVelocity =
      -(this.targetScrollY - this.currentScrollY) * this.scrollSensitivity;

    // Calculate scroll velocity magnitude - how fast we're scrolling
    const velocityMagnitude = Math.abs(
      this.targetScrollY - this.currentScrollY
    );

    // Check if we're "effectively" stopped scrolling (very small velocity)
    const isScrolling = velocityMagnitude > 0.01;

    // Only apply chromatic aberration when scrolling
    if (this.uniforms.uOffset !== undefined) {
      if (isScrolling) {
        // When scrolling, apply the effect based on scroll velocity
        this.uniforms.uOffset.value.set(
          0.0, // No horizontal effect by default
          scrollVelocity * this.intensity // Vertical effect based on scroll velocity
        );
      } else {
        // When not scrolling, set the offset to zero to disable the effect
        this.uniforms.uOffset.value.set(0.0, 0.0);
      }
    }

    // Update time uniform for animations (if needed)
    if (this.uniforms.uTime !== undefined) {
      this.uniforms.uTime.value =
        this.clock.getElapsedTime() * this.animationSpeed;
    }

    // Update mesh position to follow the image during scroll
    this.updateMeshPosition();

    // Render scene
    // this.renderer.render(scene, this.camera);
    this.composer.render();

    // Continue animation loop
    this.animationFrameId = requestAnimationFrame(this.animate);
  };
}
