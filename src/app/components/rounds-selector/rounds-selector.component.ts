import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, AfterViewInit, OnChanges, SimpleChanges, OnInit } from '@angular/core';

@Component({
  selector: 'app-rounds-selector',
  templateUrl: './rounds-selector.component.html',
  styleUrls: ['./rounds-selector.component.scss']
})
export class RoundsSelectorComponent implements OnInit, AfterViewInit, OnChanges {
  @ViewChild('roundsContainer') roundsContainer!: ElementRef;
  @ViewChild('selectedRoundElement') selectedRoundElement!: ElementRef;
  
  @Input() selectedRound: string = '1';
  @Input() currentRound: number = 1;
  @Input() isLiveRound: boolean = false;
  @Input() rounds: string[] = [];
  @Output() roundChange = new EventEmitter<string>();

  private scrollTimeout: any;

  ngOnInit() {
    this.scheduleScroll();
  }

  ngAfterViewInit() {
    this.scheduleScroll();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['selectedRound'] || changes['currentRound']) {
      this.scheduleScroll();
    }
  }

  onRoundChange(round: string) {
    this.roundChange.emit(round);
  }

  getRoundLabel(round: string): string {
    if (isNaN(Number(round))) {
      // It's a playoff phase
      switch (round) {
        case 'Reclasificación': return 'Reclas';
        case 'Cuartos de Final': return '4tos';
        case 'Semifinal': return 'Semis';
        case 'Final': return 'Final';
        default: return round;
      }
    }
    return `J${round}`;
  }

  private scheduleScroll() {
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }

    this.scrollTimeout = setTimeout(() => {
      this.scrollToSelectedRound();
      setTimeout(() => this.scrollToSelectedRound(), 100);
    }, 0);
  }

  private scrollToSelectedRound() {
    if (!this.roundsContainer?.nativeElement) return;

    const container = this.roundsContainer.nativeElement;
    const selectedChip = container.querySelector(`.round-chip[data-round="${this.selectedRound}"]`);
    
    if (selectedChip) {
      const containerWidth = container.offsetWidth;
      const chipLeft = selectedChip.offsetLeft;
      const chipWidth = selectedChip.offsetWidth;
      
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