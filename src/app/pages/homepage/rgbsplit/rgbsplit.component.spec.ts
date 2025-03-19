import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RgbsplitComponent } from './rgbsplit.component';

describe('RgbsplitComponent', () => {
  let component: RgbsplitComponent;
  let fixture: ComponentFixture<RgbsplitComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RgbsplitComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RgbsplitComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
