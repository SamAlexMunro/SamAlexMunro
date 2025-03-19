import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import * as THREE from 'three';

@Component({
  selector: 'app-water-blob',
  standalone: true,
  template: `<div
    #canvasContainer
    style="width: 100%; height: 100vh; display: block; position: absolute; top: 0; left: 0; z-index: -1"
  ></div>`,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class WaterBlobComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer', { static: true }) container!: ElementRef;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private blobMesh!: THREE.Mesh;
  private animationId!: number;

  // Shader uniforms for the noise animation.
  private uniforms: any;

  ngAfterViewInit(): void {
    this.initThree();
    this.animate();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationId);
  }

  initThree(): void {
    const width = this.container.nativeElement.clientWidth;
    const height = this.container.nativeElement.clientHeight;

    // Create renderer with transparency enabled.
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    // Use transparent clear color.
    this.renderer.setClearColor(0x000000, 0);
    this.container.nativeElement.appendChild(this.renderer.domElement);

    // Create scene without a background.
    this.scene = new THREE.Scene();
    this.scene.background = null;

    // Create the camera.
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.scene.add(this.camera);
    this.updateCameraPosition();

    // Define shader uniforms.
    this.uniforms = {
      uTime: { value: 0.0 },
      uNoiseScale: { value: 0.5 },
    };

    // Create a sphere geometry.
    const geometry = new THREE.SphereGeometry(1, 128, 128);

    // Create a ShaderMaterial that produces an iridescent glass effect.
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: this.vertexShader(),
      fragmentShader: this.fragmentShader(),
      transparent: true,
    });

    // Create and add the blob mesh.
    this.blobMesh = new THREE.Mesh(geometry, material);
    const blobMesh2 = new THREE.Mesh(geometry, material);
    const blobMesh3 = new THREE.Mesh(geometry, material);
    const blobMesh4 = new THREE.Mesh(geometry, material);
    blobMesh2.translateX(-0.2);
    blobMesh2.translateY(-0.5);
    blobMesh2.scale.set(0.3, 0.3, 0.3);

    blobMesh3.translateX(0.3);
    blobMesh3.translateY(-0.7);
    blobMesh3.scale.set(0.2, 0.2, 0.2);

    this.blobMesh.translateX(0.15);
    this.blobMesh.scale.set(0.4, 0.4, 0.4);
    this.scene.add(this.blobMesh);
    this.scene.add(blobMesh2);
    this.scene.add(blobMesh3);

    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  updateCameraPosition(): void {
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const distance = 1.0 / Math.tan(fov / 2);
    this.camera.position.z = distance;
  }

  onWindowResize(): void {
    const width = this.container.nativeElement.clientWidth;
    const height = this.container.nativeElement.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.updateCameraPosition();
  }

  animate(): void {
    // Increment time slowly for smooth morphing.
    this.uniforms.uTime.value += 0.002;
    this.renderer.render(this.scene, this.camera);
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  // Vertex shader: displaces vertices using simplex noise.
  vertexShader(): string {
    return `
      uniform float uTime;
      uniform float uNoiseScale;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPosition;

      // Simplex noise functions (Ashima Arts)
      vec3 mod289(vec3 x) {
        return x - floor(x * (1.0/289.0)) * 289.0;
      }
      vec4 mod289(vec4 x) {
        return x - floor(x * (1.0/289.0)) * 289.0;
      }
      vec4 permute(vec4 x) {
        return mod289(((x*34.0)+1.0)*x);
      }
      vec4 taylorInvSqrt(vec4 r){
        return 1.79284291400159 - 0.85373472095314 * r;
      }
      float snoise(vec3 v){
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

        vec3 i = floor(v + dot(v, vec3(C.y)));
        vec3 x0 = v - i + dot(i, vec3(C.x));

        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g, l.zxy);
        vec3 i2 = max(g, l.zxy);

        vec3 x1 = x0 - i1 + C.x;
        vec3 x2 = x0 - i2 + 2.0 * C.x;
        vec3 x3 = x0 - 1.0 + 3.0 * C.x;

        i = mod289(i);
        vec4 p = permute(permute(permute(
                  i.z + vec4(0.0, i1.z, i2.z, 1.0))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0));

        float n_ = 1.0/7.0;
        vec3 ns = n_ * D.wyz - D.xzx;

        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);

        vec4 x = x_ * ns.x + ns.y;
        vec4 y = y_ * ns.x + ns.y;
        vec4 h = 1.0 - abs(x) - abs(y);

        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);

        vec4 s0 = floor(b0) * 2.0 + 1.0;
        vec4 s1 = floor(b1) * 2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));

        vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);

        vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;

        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
      }

      void main() {
        vUv = uv;
        vNormal = normal;
        // Compute view position (in view space)
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;

        // Displace the vertex using noise (using a lower factor for smoother deformation).
        float noise = snoise(vec3(position * uNoiseScale + uTime));
        vec3 newPosition = position + normal * noise * 0.1;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
      }
    `;
  }

  // Fragment shader: Creates a softer, iridescent glass effect.
  fragmentShader(): string {
    return `
uniform float uTime;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
  // Compute view direction.
  vec3 viewDir = normalize(vViewPosition);
  // Fresnel term with a softer exponent.
  float fresnel = pow(1.0 - dot(normalize(vNormal), viewDir), 2.0);

  // Lower intensity iridescence with a lighter overall tone.
  vec3 iridescence = vec3(
    0.9 + 0.5 * sin(uTime + vUv.x * 10.0),
    0.9 + 0.5 * sin(uTime + vUv.y * 10.0 + 2.0),
    0.9 + 0.5 * sin(uTime + (vUv.x + vUv.y) * 10.0 + 4.0)
  );

  // Use a near-white base color to avoid a dark (black) hue.
  vec3 baseColor = vec3(0.1, 0.1, 0.1);
  // Mix the base color with the iridescence based on the Fresnel term.
  vec3 color = mix(baseColor, iridescence, fresnel);

  // Set moderate transparency.
  gl_FragColor = vec4(color, 0.5);
}
    `;
  }
}
