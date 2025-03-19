// canvas.component.ts
import { DOCUMENT } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  Inject,
  NgZone,
  OnDestroy,
  OnInit,
  Renderer2,
  ViewChild,
} from '@angular/core';
import { ShaderEffectDirective } from '../rgb-shift-distort-on-scroll.directive';

@Component({
  selector: 'app-canvas-controller',
  standalone: true,
  imports: [ShaderEffectDirective],
  template: `
    <!-- Hidden image container -->
    <div #imageContainer class="image-container">
      <img alt src="js.png" appShaderEffect />
      <img alt src="ts.png" appShaderEffect />
      <img alt src="react.png" appShaderEffect />
      <img alt src="react-native.svg" appShaderEffect />
      <img alt src="angular.png" appShaderEffect />
      <img alt src="three.png" appShaderEffect />
      <img alt src="gsap.png" appShaderEffect />
      <img alt src="scss.png" appShaderEffect />
      <img alt src="css.png" appShaderEffect />
      <img alt src="git.png" appShaderEffect />
      <img alt src="google-cloud.svg" appShaderEffect />
      <img alt src="graphql.png" appShaderEffect />
    </div>

    <!-- Overlay meshes directly on the DOM instead of using Three.js -->
    <div #meshContainer class="mesh-container">
      <!-- Meshes will be added here dynamically -->
    </div>
  `,
  styles: [
    `
      .image-container {
        position: relative;
        width: 100%;
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        align-items: center;
        justify-content: center;
      }
      img {
        width: 100px;
        opacity: 0; /* Semi-visible for debugging */
      }
      .mesh-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1001;
      }
      .mesh-overlay {
        position: fixed;
        display: flex;
        justify-content: center;
        align-items: center;
        pointer-events: none;
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
      }
    `,
  ],
})
export class CanvasControllerComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  @ViewChild('imageContainer', { static: false }) imageContainer!: ElementRef;
  @ViewChild('meshContainer', { static: false }) meshContainer!: ElementRef;

  private overlayElements: HTMLElement[] = [];
  private animationFrameId: number | null = null;
  private scrollListener!: Function;
  private resizeListener!: Function;

  constructor(
    private ngZone: NgZone,
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    // Set up scroll listener
    this.scrollListener = this.renderer.listen('window', 'scroll', () => {
      this.updateOverlayPositions();
    });

    // Set up resize listener
    this.resizeListener = this.renderer.listen('window', 'resize', () => {
      this.updateOverlayPositions();
    });
  }

  ngAfterViewInit(): void {
    // Wait for images to load
    setTimeout(() => {
      this.createOverlays();
      this.startAnimationLoop();
    }, 500);
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    // Remove event listeners
    if (this.scrollListener) {
      this.scrollListener();
    }
    if (this.resizeListener) {
      this.resizeListener();
    }

    // Clean up overlay elements
    this.clearOverlays();
  }

  private createOverlays(): void {
    // Clean up any existing overlays
    this.clearOverlays();

    if (!this.imageContainer || !this.meshContainer) {
      console.error('Container elements not found');
      return;
    }

    const images = this.imageContainer.nativeElement.querySelectorAll('img');

    images.forEach((img: HTMLImageElement, index: number) => {
      // Only create overlay if image is loaded
      if (img.complete) {
        this.createOverlayForImage(img, index);
      } else {
        img.onload = () => this.createOverlayForImage(img, index);
      }
    });
  }

  private createOverlayForImage(img: HTMLImageElement, index: number): void {
    // Get image position and dimensions
    const rect = img.getBoundingClientRect();

    // Create overlay element
    const overlay = this.renderer.createElement('div');
    this.renderer.addClass(overlay, 'mesh-overlay');

    // Store the original image reference for better positioning calculations
    (overlay as any).__sourceImage = img;

    // Set dimensions to match the image
    this.renderer.setStyle(overlay, 'width', `${rect.width}px`);
    this.renderer.setStyle(overlay, 'height', `${rect.height}px`);

    // Set background image to be the same as the source image
    this.renderer.setStyle(overlay, 'background-image', `url(${img.src})`);

    // Position the overlay
    this.updateOverlayPosition(overlay, img);

    // No glow or animation effects

    // Add to the mesh container
    this.renderer.appendChild(this.meshContainer.nativeElement, overlay);

    // Store reference for updates
    this.overlayElements.push(overlay);
  }

  private updateOverlayPosition(
    overlay: HTMLElement,
    img: HTMLImageElement
  ): void {
    // Get the image position relative to the viewport
    const rect = img.getBoundingClientRect();

    // Position overlay exactly where the image is, relative to the document
    this.renderer.setStyle(overlay, 'position', 'fixed');
    this.renderer.setStyle(overlay, 'left', `${rect.left}px`);
    this.renderer.setStyle(overlay, 'top', `${rect.top}px`);
  }

  private updateOverlayPositions(): void {
    if (!this.imageContainer) return;

    this.overlayElements.forEach((overlay) => {
      const sourceImage = (overlay as any).__sourceImage;
      if (sourceImage) {
        this.updateOverlayPosition(overlay, sourceImage);
      }
    });
  }

  private startAnimationLoop(): void {
    this.ngZone.runOutsideAngular(() => {
      const animate = () => {
        this.updateOverlayPositions();
        this.animationFrameId = requestAnimationFrame(animate);
      };

      this.animationFrameId = requestAnimationFrame(animate);
    });
  }

  private clearOverlays(): void {
    if (this.meshContainer) {
      this.overlayElements.forEach((overlay) => {
        this.renderer.removeChild(this.meshContainer.nativeElement, overlay);
      });
    }

    this.overlayElements = [];
  }

  // Public method for manual refresh
  public refreshOverlays(): void {
    this.createOverlays();
  }
}
