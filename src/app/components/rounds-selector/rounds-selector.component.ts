import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, AfterViewInit, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-rounds-selector',
  templateUrl: './rounds-selector.component.html',
  styleUrls: ['./rounds-selector.component.scss']
})
export class RoundsSelectorComponent implements AfterViewInit, OnChanges {
  @ViewChild('roundsContainer') roundsContainer!: ElementRef;
  @ViewChild('selectedRoundElement') selectedRoundElement!: ElementRef;
  
  @Input() selectedRound: number = 1;
  @Input() currentRound: number = 1;
  @Input() isLiveRound: boolean = false;
  @Input() rounds: number[] = Array.from({ length: 17 }, (_, i) => i + 1);
  @Output() roundChange = new EventEmitter<number>();

  ngAfterViewInit() {
    this.scrollToSelectedRound();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['selectedRound']) {
      // Use setTimeout to ensure DOM is updated
      setTimeout(() => this.scrollToSelectedRound(), 0);
    }
  }

  onRoundChange(round: number) {
    this.roundChange.emit(round);
  }

  private scrollToSelectedRound() {
    if (!this.roundsContainer?.nativeElement) return;

    const container = this.roundsContainer.nativeElement;
    const selectedChip = container.querySelector('.round-chip.active');
    
    if (selectedChip) {
      // Calculate the center position for the selected round
      const containerWidth = container.offsetWidth;
      const chipLeft = selectedChip.offsetLeft;
      const chipWidth = selectedChip.offsetWidth;
      
      // Center the selected round in the container
      const scrollPosition = chipLeft - (containerWidth / 2) + (chipWidth / 2);
      
      container.scrollTo({
        left: scrollPosition,
        behavior: 'smooth'
      });
    }
  }
}