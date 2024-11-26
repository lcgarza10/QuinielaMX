import { Pipe, PipeTransform } from '@angular/core';
import { PlayoffMatch } from '../services/football.service';

@Pipe({
  name: 'filterByRound'
})
export class PlayoffRoundPipe implements PipeTransform {
  transform(matches: PlayoffMatch[] | null, round: string): PlayoffMatch[] {
    if (!matches || !round) return [];
    return matches.filter(match => match.round === round);
  }
}