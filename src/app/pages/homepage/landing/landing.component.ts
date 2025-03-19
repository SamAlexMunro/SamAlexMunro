import { Component, ElementRef, ViewChild } from '@angular/core';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/all';
import { annotate } from 'rough-notation';
import { WaterBlobComponent } from '../../../../../bubble';
import { CanvasControllerComponent } from '../canvascontroller/canvascontroller.component';
import { FadingDisplacementComponent } from '../displacement/displacement.component';
import {
  FabricHost,
  FabricSimulationComponent,
} from '../fabric-simulation/fabric-simulation.component';
import { FabricComponent } from '../fabric/fabric.component';
import { ScrollBlobComponent } from '../ferrofluid/ferrofluid.component';
import { SkillsComponent } from '../skills/skills.component';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    WaterBlobComponent,
    SkillsComponent,
    FabricComponent,
    ScrollBlobComponent,
    FabricSimulationComponent,
    FabricHost,
    FadingDisplacementComponent,
    CanvasControllerComponent,
  ],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  @ViewChild('jobTitle') jobTitle?: ElementRef;
  @ViewChild('engaging') engaging?: ElementRef;
  @ViewChild('users') users?: ElementRef;
  @ViewChild('businessValue') businessValue?: ElementRef;
  @ViewChild('codeQuality') codeQuality?: ElementRef;
  @ViewChild('content') content?: ElementRef;

  scrollToSkills() {
    console.log('hello');
    document
      .getElementById('skills')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // scrollIntoView()
  }

  ngAfterViewInit() {
    gsap.registerPlugin(ScrollTrigger);

    setTimeout(() => {
      this.setupCircleWordEffect(this.engaging, 0, 0);
      this.setupUnderlineWordEffect(this.users, 500, 2);
      this.setupUnderlineWordEffect(this.businessValue, 900, 1);
      this.setupUnderlineWordEffect(this.codeQuality, 1300, 2);
    }, 1750);
  }

  setupHighlightWordEffect(element?: ElementRef, iterations = 1, delay = 0) {
    if (!element) return;

    const annotation = annotate(element.nativeElement, {
      type: 'highlight', // Annotation type
      multiline: true,
      color: '#F49939', // Color of the circle
      iterations,
      padding: 0,
    });

    // Display the annotation
    setTimeout(() => {
      annotation.show();
    }, delay);
  }

  setupCircleWordEffect(element?: ElementRef, iterations = 1, delay = 1200) {
    if (!element) return;

    const annotation = annotate(element.nativeElement, {
      type: 'box', // Annotation type
      color: '#F49939', // Color of the circle
      strokeWidth: 3, // Thickness of the circle's stroke
      padding: 2, // Padding around the element
      iterations: 2,
      animationDuration: 1000,
      multiline: true,
    });

    // Display the annotation
    setTimeout(() => {
      annotation.show();
    }, delay);
  }

  setupUnderlineWordEffect(element?: ElementRef, delay = 3000, iterations = 1) {
    if (!element) return;

    const annotation = annotate(element.nativeElement, {
      type: 'underline', // Annotation type
      color: '#F49939', // Color of the circle
      strokeWidth: 2, // Thickness of the circle's stroke
      padding: 2, // Padding around the element
      iterations,
      multiline: true,
    });

    // Display the annotation
    setTimeout(() => {
      annotation.show();
    }, delay);
  }
}
