import { Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { AdsenseService } from '../../services/adsense.service';

@Component({
  selector: 'app-adsense',
  template: `
    <ins #adsenseSlot
      class="adsbygoogle"
      [style.display]="'block'"
      [style.width.px]="width"
      [style.height.px]="height"
      [attr.data-ad-client]="adClient"
      [attr.data-ad-slot]="adSlotId"
      [attr.data-ad-format]="adFormat"
      [attr.data-full-width-responsive]="responsive">
    </ins>
  `,
  styles: [`
    :host {
      display: block;
      margin: 15px 0;
    }
  `]
})
export class AdsenseComponent implements OnInit {
  @ViewChild('adsenseSlot', { static: true }) adsenseSlot!: ElementRef;

  @Input() adClient: string = 'ca-pub-9673170329839085';
  @Input() adSlotId: string = ''; // You'll need to add your ad slot ID
  @Input() adFormat: string = 'auto';
  @Input() width: number = 320;
  @Input() height: number = 100;
  @Input() responsive: boolean = true;

  constructor(private adsenseService: AdsenseService) {}

  ngOnInit() {
    this.adsenseService.pushAd(this.adsenseSlot.nativeElement);
  }
}
