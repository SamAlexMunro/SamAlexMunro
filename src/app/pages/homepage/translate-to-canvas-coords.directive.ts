// image-overlay.directive.ts
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

@Directive({
  selector: '[translateToCanvasCoords]',
  standalone: true,
})
export class TranslateToCanvasCoords
  implements OnInit, AfterViewInit, OnDestroy
{
  @Input() overlayOpacity: number = 1;
  @Input() overlayZIndex: number = 1001;

  private overlay: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private scrollListener!: Function;
  private resizeListener!: Function;
  private animationFrameId: number | null = null;
  private meshContainer: HTMLElement | null = null;

  constructor(
    private el: ElementRef,
    private renderer: Renderer2,
    private ngZone: NgZone,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    // Create or get the container for all overlays
    this.ensureMeshContainerExists();

    // Set up event listeners
    this.setupEventListeners();
  }

  ngAfterViewInit(): void {
    // Create the overlay once the image is loaded
    if ((this.el.nativeElement as HTMLImageElement).complete) {
      this.createOverlay();
    } else {
      this.el.nativeElement.addEventListener('load', () => {
        this.createOverlay();
      });
    }
  }

  ngOnDestroy(): void {
    // Remove the overlay
    if (this.overlay && this.meshContainer) {
      this.renderer.removeChild(this.meshContainer, this.overlay);
    }

    // Clean up listeners
    if (this.scrollListener) {
      this.scrollListener();
    }
    if (this.resizeListener) {
      this.resizeListener();
    }

    // Cancel animation frame
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    // Disconnect resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  private ensureMeshContainerExists(): void {
    // Check if container already exists
    let container = this.document.getElementById('image-overlay-container');

    if (!container) {
      // Create the container if it doesn't exist
      container = this.renderer.createElement('div');
      this.renderer.setAttribute(container, 'id', 'image-overlay-container');
      this.renderer.setStyle(container, 'position', 'fixed');
      this.renderer.setStyle(container, 'top', '0');
      this.renderer.setStyle(container, 'left', '0');
      this.renderer.setStyle(container, 'width', '100%');
      this.renderer.setStyle(container, 'height', '100%');
      this.renderer.setStyle(container, 'pointer-events', 'none');
      this.renderer.setStyle(
        container,
        'z-index',
        this.overlayZIndex.toString()
      );

      // Add to document body
      this.renderer.appendChild(this.document.body, container);
    }

    this.meshContainer = container;
  }

  private setupEventListeners(): void {
    // Handle scroll events
    this.ngZone.runOutsideAngular(() => {
      this.scrollListener = this.renderer.listen('window', 'scroll', () => {
        if (this.overlay) {
          window.requestAnimationFrame(() => {
            this.updateOverlayPosition();
          });
        }
      });

      // Handle resize events
      this.resizeListener = this.renderer.listen('window', 'resize', () => {
        if (this.overlay) {
          window.requestAnimationFrame(() => {
            this.updateOverlayDimensions();
            this.updateOverlayPosition();
          });
        }
      });

      // Setup ResizeObserver to detect changes in the image size
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => {
          if (this.overlay) {
            this.updateOverlayDimensions();
            this.updateOverlayPosition();
          }
        });

        this.resizeObserver.observe(this.el.nativeElement);
      }
    });
  }

  private createOverlay(): void {
    if (!this.meshContainer) return;

    const img = this.el.nativeElement as HTMLImageElement;

    // Create overlay element
    this.overlay = this.renderer.createElement('div');
    this.renderer.addClass(this.overlay, 'image-overlay');

    // Set styles
    this.renderer.setStyle(this.overlay, 'position', 'fixed');
    this.renderer.setStyle(this.overlay, 'display', 'flex');
    this.renderer.setStyle(this.overlay, 'justify-content', 'center');
    this.renderer.setStyle(this.overlay, 'align-items', 'center');
    this.renderer.setStyle(this.overlay, 'pointer-events', 'none');
    this.renderer.setStyle(this.overlay, 'background-image', `url(${img.src})`);
    this.renderer.setStyle(this.overlay, 'background-size', 'contain');
    this.renderer.setStyle(this.overlay, 'background-repeat', 'no-repeat');
    this.renderer.setStyle(this.overlay, 'background-position', 'center');
    this.renderer.setStyle(
      this.overlay,
      'opacity',
      this.overlayOpacity.toString()
    );

    // Set initial dimensions and position
    this.updateOverlayDimensions();
    this.updateOverlayPosition();

    // Add to container
    this.renderer.appendChild(this.meshContainer, this.overlay);
  }

  private updateOverlayDimensions(): void {
    if (!this.overlay) return;

    const img = this.el.nativeElement as HTMLImageElement;
    const rect = img.getBoundingClientRect();

    this.renderer.setStyle(this.overlay, 'width', `${rect.width}px`);
    this.renderer.setStyle(this.overlay, 'height', `${rect.height}px`);
  }

  private updateOverlayPosition(): void {
    if (!this.overlay) return;

    const img = this.el.nativeElement as HTMLImageElement;
    const rect = img.getBoundingClientRect();

    this.renderer.setStyle(this.overlay, 'left', `${rect.left}px`);
    this.renderer.setStyle(this.overlay, 'top', `${rect.top}px`);
  }
}
