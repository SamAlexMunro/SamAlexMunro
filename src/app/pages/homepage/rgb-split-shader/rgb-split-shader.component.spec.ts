import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RgbSplitShaderComponent } from './rgb-split-shader.component';

describe('RgbSplitShaderComponent', () => {
  let component: RgbSplitShaderComponent;
  let fixture: ComponentFixture<RgbSplitShaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RgbSplitShaderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RgbSplitShaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
