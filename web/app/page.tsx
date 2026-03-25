'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Stock, StockStats, TypeLabels, MarketType, StockType, DefaultAlerts } from '@/types/stock';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { StockDetailModal } from '@/components/stock-detail-modal';
import { 
  Plus, Search, RefreshCw, TrendingUp, Wallet, BarChart3, Globe, 
  Edit2, Trash2, Bell, Activity, Clock
} from 'lucide-react';

export default function Home() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [stats, setStats] = useState<StockStats>({ total: 0, withPosition: 0, etfs: 0, hkUs: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [marketFilter, setMarketFilter] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<Stock | null>(null);
  const [detailStock, setDetailStock] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // 实时数据轮询（5秒间隔）
  const { data: realtimeData, meta: realtimeMeta, loading: realtimeLoading, lastUpdated, refresh: refreshRealtime } = useRealtimeData({ interval: 5000 });

  const [formData, setFormData] = useState<Partial<Stock>>({
    code: '',
    name: '',
    market: 'sh',
    type: 'individual',
    cost: 0,
    alerts: DefaultAlerts
  });

  // 请求通知权限
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      setNotificationsEnabled(true);
    }
  }, []);

  const requestNotification = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationsEnabled(permission === 'granted');
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [stocksRes, statsRes] = await Promise.all([
        fetch('/api/stocks'),
        fetch('/api/stats')
      ]);
      
      const stocksData = await stocksRes.json();
      const statsData = await statsRes.json();
      
      if (stocksData.success) setStocks(stocksData.data);
      if (statsData.success) setStats(statsData.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 合并静态数据和实时数据
  const mergedStocks = stocks.map(stock => {
    const realtime = realtimeData[stock.code];
    if (realtime) {
      return { ...stock, ...realtime };
    }
    return stock;
  });

  const filteredStocks = mergedStocks.filter(stock => {
    const matchSearch = stock.code.toLowerCase().includes(search.toLowerCase()) ||
                       stock.name.toLowerCase().includes(search.toLowerCase());
    const matchType = !typeFilter || stock.type === typeFilter;
    const matchMarket = !marketFilter || stock.market === marketFilter;
    return matchSearch && matchType && matchMarket;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const url = editingStock ? `/api/stocks/${editingStock.code}` : '/api/stocks';
    const method = editingStock ? 'PUT' : 'POST';
    
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        setDialogOpen(false);
        setEditingStock(null);
        setFormData({ code: '', name: '', market: 'sh', type: 'individual', cost: 0, alerts: DefaultAlerts });
        fetchData();
      }
    } catch (error) {
      console.error('Failed to save stock:', error);
    }
  };

  const handleDelete = async (code: string) => {
    if (!confirm(`确定要删除 ${code} 吗？`)) return;
    
    try {
      await fetch(`/api/stocks/${code}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Failed to delete stock:', error);
    }
  };

  const openEdit = (stock: Stock) => {
    setEditingStock(stock);
    setFormData(stock);
    setDialogOpen(true);
  };

  const openAdd = () => {
    setEditingStock(null);
    setFormData({ code: '', name: '', market: 'sh', type: 'individual', cost: 0, alerts: DefaultAlerts });
    setDialogOpen(true);
  };

  const openDetail = (stock: any) => {
    setDetailStock(stock);
    setDetailOpen(true);
  };

  const getMarketBadgeColor = (market: string) => {
    const colors: Record<string, string> = {
      sh: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      sz: 'bg-green-500/10 text-green-400 border-green-500/30',
      hk: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      us: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
      fx: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
      bj: 'bg-red-500/10 text-red-400 border-red-500/30',
    };
    return colors[market] || 'bg-gray-500/10 text-gray-400';
  };

  const getTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      individual: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      etf: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
      gold: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    };
    return colors[type] || 'bg-gray-500/10 text-gray-400';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-lg glow-blue">
              📊
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">股票池</h1>
              <p className="text-xs text-muted-foreground">Stock Pool Manager</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* 实时数据状态 */}
            <div 
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
                !realtimeLoading 
                  ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                  : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
              }`}
              title={`数据源: ${realtimeMeta?.source || 'unknown'} | 成功: ${realtimeMeta?.count || 0}/${realtimeMeta?.total || 0}`}
            >
              <Activity className="w-4 h-4" />
              <span className="text-sm hidden sm:inline">
                {realtimeLoading ? '更新中...' : (realtimeMeta?.source || '实时')}
              </span>
            </div>

            {/* 最后更新时间 */}
            {lastUpdated && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-muted/30 border-border text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span className="text-sm hidden sm:inline">
                  {lastUpdated.toLocaleTimeString('zh-CN', { hour12: false })}
                </span>
              </div>
            )}

            {/* 通知按钮 */}
            <Button 
              variant="outline" 
              size="icon"
              onClick={requestNotification}
              className={notificationsEnabled ? 'text-green-400' : ''}
            >
              <Bell className="w-4 h-4" />
            </Button>

            <Button onClick={openAdd} className="gap-2">
              <Plus className="w-4 h-4" />
              添加股票
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-card border-border hover:border-primary/50 transition-all duration-200 hover:-translate-y-0.5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">总股票数</CardTitle>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono">{stats.total}</div>
              <p className="text-xs text-green-400 mt-1">{lastUpdated ? '5秒刷新' : '加载中...'}</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border hover:border-primary/50 transition-all duration-200 hover:-translate-y-0.5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">持仓股票</CardTitle>
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono">{stats.withPosition}</div>
              <p className="text-xs text-muted-foreground mt-1">已配置成本</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border hover:border-primary/50 transition-all duration-200 hover:-translate-y-0.5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">ETF 基金</CardTitle>
              <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-yellow-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono">{stats.etfs}</div>
              <p className="text-xs text-muted-foreground mt-1">指数跟踪</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border hover:border-primary/50 transition-all duration-200 hover:-translate-y-0.5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">港股/美股</CardTitle>
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Globe className="w-4 h-4 text-purple-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono">{stats.hkUs}</div>
              <p className="text-xs text-muted-foreground mt-1">跨境资产</p>
            </CardContent>
          </Card>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 flex gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索代码或名称..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-card border-border"
              />
            </div>
            
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px] bg-card border-border">
                <SelectValue placeholder="全部类型" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="">全部类型</SelectItem>
                <SelectItem value="individual">个股</SelectItem>
                <SelectItem value="etf">ETF</SelectItem>
                <SelectItem value="gold">黄金</SelectItem>
              </SelectContent>
            </Select>

            <Select value={marketFilter} onValueChange={setMarketFilter}>
              <SelectTrigger className="w-[140px] bg-card border-border">
                <SelectValue placeholder="全部市场" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="">全部市场</SelectItem>
                <SelectItem value="sh">上海</SelectItem>
                <SelectItem value="sz">深圳</SelectItem>
                <SelectItem value="hk">港股</SelectItem>
                <SelectItem value="us">美股</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button variant="outline" onClick={fetchData} disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>

        {/* Table */}
        <Card className="bg-card border-border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">股票信息</TableHead>
                  <TableHead className="text-muted-foreground">市场</TableHead>
                  <TableHead className="text-muted-foreground">现价/涨跌</TableHead>
                  <TableHead className="text-muted-foreground">持仓/盈亏</TableHead>
                  <TableHead className="text-muted-foreground">预警配置</TableHead>
                  <TableHead className="text-muted-foreground text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStocks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-16">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center text-3xl">
                          📭
                        </div>
                        <p className="text-lg font-medium">暂无股票</p>
                        <p className="text-sm text-muted-foreground">点击"添加股票"开始构建你的股票池</p>
                        <Button onClick={openAdd} className="mt-2">添加股票</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStocks.map((stock: any) => {
                    const hasRealtime = stock.current > 0;
                    const isUp = stock.change_pct > 0;
                    const isProfit = stock.pnl_pct > 0;
                    
                    return (
                      <TableRow 
                        key={stock.code} 
                        className="border-border hover:bg-muted/50 cursor-pointer"
                        onClick={() => openDetail(stock)}
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-mono font-semibold">{stock.code}</span>
                            <span className="text-sm text-muted-foreground">{stock.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getMarketBadgeColor(stock.market)}>
                            {stock.market.toUpperCase()}
                          </Badge>
                          <Badge variant="outline" className={`ml-1 ${getTypeBadgeColor(stock.type)}`}>
                            {TypeLabels[stock.type as StockType]}
                          </Badge>
                        </TableCell>
                        
                        <TableCell>
                          {hasRealtime ? (
                            <div className="flex flex-col">
                              <span className={`font-mono font-bold ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                                ¥{stock.current.toFixed(2)}
                              </span>
                              <span className={`text-xs ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                                {isUp ? '+' : ''}{stock.change_pct}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        
                        <TableCell>
                          {stock.cost > 0 ? (
                            <div className="flex flex-col">
                              <span className="font-mono text-yellow-400">¥{stock.cost.toFixed(3)}</span>
                              {hasRealtime && (
                                <span className={`text-xs ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                                  {isProfit ? '+' : ''}{stock.pnl_pct}% ({isProfit ? '+' : ''}¥{stock.pnl_amount?.toFixed(2)})
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {stock.alerts?.ma_monitor && (
                              <Badge variant="secondary" className="text-xs">MA</Badge>
                            )}
                            {stock.alerts?.rsi_monitor && (
                              <Badge variant="secondary" className="text-xs">RSI</Badge>
                            )}
                            {stock.alerts?.gap_monitor && (
                              <Badge variant="secondary" className="text-xs">缺口</Badge>
                            )}
                            {stock.alerts?.trailing_stop && (
                              <Badge variant="secondary" className="text-xs">追踪</Badge>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={(e) => { e.stopPropagation(); openEdit(stock); }}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm" 
                              onClick={(e) => { e.stopPropagation(); handleDelete(stock.code); }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </main>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingStock ? '编辑股票' : '添加股票'}</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">股票代码 *</label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="如: 600519"
                  disabled={!!editingStock}
                  required
                  className="bg-background border-border font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">股票名称 *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="如: 贵州茅台"
                  required
                  className="bg-background border-border"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">市场 *</label>
                <Select 
                  value={formData.market} 
                  onValueChange={(v) => setFormData({ ...formData, market: v as MarketType })}
                >
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="sh">上海 (SH)</SelectItem>
                    <SelectItem value="sz">深圳 (SZ)</SelectItem>
                    <SelectItem value="hk">港股 (HK)</SelectItem>
                    <SelectItem value="us">美股 (US)</SelectItem>
                    <SelectItem value="bj">北交所 (BJ)</SelectItem>
                    <SelectItem value="fx">外汇 (FX)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">类型 *</label>
                <Select 
                  value={formData.type} 
                  onValueChange={(v) => setFormData({ ...formData, type: v as StockType })}
                >
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="individual">个股</SelectItem>
                    <SelectItem value="etf">ETF</SelectItem>
                    <SelectItem value="gold">黄金</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">持仓成本 (0表示仅观察)</label>
              <Input
                type="number"
                step="0.001"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                placeholder="0"
                className="bg-background border-border font-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">技术指标监控</label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.alerts?.ma_monitor}
                    onChange={(e) => setFormData({
                      ...formData,
                      alerts: { ...formData.alerts, ma_monitor: e.target.checked }
                    })}
                    className="rounded border-border"
                  />
                  <span className="text-sm">均线金叉死叉</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.alerts?.rsi_monitor}
                    onChange={(e) => setFormData({
                      ...formData,
                      alerts: { ...formData.alerts, rsi_monitor: e.target.checked }
                    })}
                    className="rounded border-border"
                  />
                  <span className="text-sm">RSI超买超卖</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.alerts?.gap_monitor}
                    onChange={(e) => setFormData({
                      ...formData,
                      alerts: { ...formData.alerts, gap_monitor: e.target.checked }
                    })}
                    className="rounded border-border"
                  />
                  <span className="text-sm">跳空缺口</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.alerts?.trailing_stop}
                    onChange={(e) => setFormData({
                      ...formData,
                      alerts: { ...formData.alerts, trailing_stop: e.target.checked }
                    })}
                    className="rounded border-border"
                  />
                  <span className="text-sm">动态止盈</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit">保存</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stock Detail Modal */}
      <StockDetailModal 
        stock={detailStock} 
        open={detailOpen} 
        onOpenChange={setDetailOpen} 
      />
    </div>
  );
}
