import { Component } from '@angular/core';
import { FadingDisplacementComponent } from '../displacement/displacement.component';
import { SmoothScrollComponent } from '../rgbsplit/rgbsplit.component';

@Component({
  selector: 'app-skills',
  standalone: true,
  imports: [FadingDisplacementComponent, SmoothScrollComponent],
  templateUrl: './skills.component.html',
  styleUrl: './skills.component.scss',
})
export class SkillsComponent {}
