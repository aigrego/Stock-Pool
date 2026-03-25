'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RealtimeStock } from '@/hooks/useRealtimeData';
import { StockChart } from './stock-chart';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Clock } from 'lucide-react';

interface StockDetailModalProps {
  stock: RealtimeStock | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StockDetailModal({ stock, open, onOpenChange }: StockDetailModalProps) {
  if (!stock) return null;

  const isProfit = stock.pnlPct > 0;
  const isUp = stock.changePct > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-mono">{stock.code}</DialogTitle>
              <p className="text-muted-foreground">{stock.name}</p>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-lg px-3 py-1">
                {(stock.market || 'unknown').toUpperCase()}
              </Badge>
              <Badge 
                variant="outline" 
                className={`text-lg px-3 py-1 ${isUp ? 'text-green-400 border-green-400/30 bg-green-400/10' : 'text-red-400 border-red-400/30 bg-red-400/10'}`}
              >
                {isUp ? '+' : ''}{stock.changePct}%
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <Card className="bg-background border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-normal">当前价格</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-mono font-bold ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                ¥{stock.current?.toFixed(2) || '-'}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-background border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-normal">持仓成本</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-mono font-bold text-yellow-400">
                ¥{stock.cost?.toFixed(3) || '-'}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-background border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-normal">盈亏比例</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2">
              {isProfit ? (
                <>
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  <div className="text-2xl font-mono font-bold text-green-400">
                    +{stock.pnlPct}%
                  </div>
                </>
              ) : (
                <>
                  <TrendingDown className="w-5 h-5 text-red-400" />
                  <div className="text-2xl font-mono font-bold text-red-400">
                    {stock.pnlPct}%
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-background border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-normal">盈亏金额</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-mono font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                {isProfit ? '+' : ''}¥{stock.pnlAmount?.toFixed(2) || '0.00'}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="flex items-center gap-2 text-sm">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">今开:</span>
            <span className="font-mono">¥{stock.open?.toFixed(2)}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">昨收:</span>
            <span className="font-mono">¥{stock.close?.toFixed(2)}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-muted-foreground">最高:</span>
            <span className="font-mono text-green-400">¥{stock.high?.toFixed(2)}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <span className="text-muted-foreground">最低:</span>
            <span className="font-mono text-red-400">¥{stock.low?.toFixed(2)}</span>
          </div>
        </div>

        {stock.volume > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>最后更新: {stock.updatedAt ? new Date(stock.updatedAt).toLocaleString('zh-CN') : '-'}</span>
            </div>
          </div>
        )}

        {/* K线图表 */}
        <div className="mt-6">
          <StockChart 
            code={stock.code} 
            market={stock.market || 'sh'} 
            name={stock.name}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
