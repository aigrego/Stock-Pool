export interface StockQuote {
  code: string;
  name: string;
  current: number;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
  bid1: number;
  ask1: number;
  timestamp: number;
}
