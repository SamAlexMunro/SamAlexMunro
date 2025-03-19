import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NavigationControllerComponent } from './navigation-controller.component';

describe('NavigationControllerComponent', () => {
  let component: NavigationControllerComponent;
  let fixture: ComponentFixture<NavigationControllerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavigationControllerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NavigationControllerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
