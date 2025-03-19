import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavigationControllerComponent } from './navigation-controller/navigation-controller.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavigationControllerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'SamAlexMunro';
}
