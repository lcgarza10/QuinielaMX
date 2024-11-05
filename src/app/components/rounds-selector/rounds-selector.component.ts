import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, AfterViewInit, OnChanges, SimpleChanges, OnInit } from '@angular/core';

@Component({
  selector: 'app-rounds-selector',
  templateUrl: './rounds-selector.component.html',
  styleUrls: ['./rounds-selector.component.scss']
})
export class RoundsSelectorComponent implements OnInit, AfterViewInit, OnChanges {
  @ViewChild('roundsContainer') roundsContainer!: ElementRef;
  @ViewChild('selectedRoundElement') selectedRoundElement!: ElementRef;
  
  @Input() selectedRound: number = 1;
  @Input() currentRound: number = 1;
  @Input() isLiveRound: boolean = false;
  @Input() rounds: number[] = Array.from({ length: 17 }, (_, i) => i + 1);
  @Output() roundChange = new EventEmitter<number>();

  private scrollTimeout: any;

  ngOnInit() {
    // Initial scroll attempt
    this.scheduleScroll();
  }

  ngAfterViewInit() {
    // Second scroll attempt after view init
    this.scheduleScroll();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['selectedRound'] || changes['currentRound']) {
      this.scheduleScroll();
    }
  }

  onRoundChange(round: number) {
    this.roundChange.emit(round);
  }

  private scheduleScroll() {
    // Clear any existing timeout
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }

    // Schedule multiple scroll attempts
    this.scrollTimeout = setTimeout(() => {
      this.scrollToSelectedRound();
      
      // Additional attempts with increasing delays
      setTimeout(() => this.scrollToSelectedRound(), 100);
      setTimeout(() => this.scrollToSelectedRound(), 300);
      setTimeout(() => this.scrollToSelectedRound(), 500);
    }, 0);
  }

  private scrollToSelectedRound() {
    if (!this.roundsContainer?.nativeElement) return;

    const container = this.roundsContainer.nativeElement;
    const selectedChip = container.querySelector(`.round-chip:nth-child(${this.selectedRound})`);
    
    if (selectedChip) {
      const containerWidth = container.offsetWidth;
      const chipLeft = selectedChip.offsetLeft;
      const chipWidth = selectedChip.offsetWidth;
      
      // Center the selected round in the container
      const scrollPosition = Math.max(0, chipLeft - (containerWidth / 2) + (chipWidth / 2));
      
      container.scrollTo({
        left: scrollPosition,
        behavior: 'smooth'
      });
    }
  }

  ngOnDestroy() {
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
  }
}