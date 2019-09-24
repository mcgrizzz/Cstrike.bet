import { RouletteRoll } from './roulette-history.service';
import { RouletteBet } from './roulette-bet';

export class User {
  id: string;
  name: string;
  tradeUrl: string;
  pictureUrl: string;
  balance: number;
  rouletteHistory: Number[];
  depositedAmount: number;
  betAmount: number;
  userType: string;
  withdrawBanned: boolean;
  totalWithdrawn: number;
  totalDeposited: number;
  totalBets: number;
  totalBetBalance: number;
}
