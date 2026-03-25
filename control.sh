#!/bin/bash
# Stock Pool API Server Control Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/server.pid"
LOG_FILE="$SCRIPT_DIR/server.log"

check_running() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

start() {
    if check_running; then
        echo "⚠️ Server is already running (PID: $(cat $PID_FILE))"
        return 1
    fi
    
    echo "🚀 Starting Stock Pool API Server..."
    cd "$SCRIPT_DIR"
    nohup python3 server.py > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    
    sleep 2
    
    if check_running; then
        echo "✅ Server started successfully!"
        echo "   PID: $(cat $PID_FILE)"
        echo "   URL: http://100.111.204.29:8080"
        echo "   Log: $LOG_FILE"
    else
        echo "❌ Server failed to start. Check $LOG_FILE"
        return 1
    fi
}

stop() {
    if ! check_running; then
        echo "⚠️ Server is not running"
        return 1
    fi
    
    PID=$(cat "$PID_FILE")
    echo "🛑 Stopping server (PID: $PID)..."
    kill "$PID" 2>/dev/null
    
    sleep 1
    
    if check_running; then
        echo "⚠️ Server did not stop gracefully, forcing..."
        kill -9 "$PID" 2>/dev/null
    fi
    
    rm -f "$PID_FILE"
    echo "✅ Server stopped"
}

status() {
    if check_running; then
        PID=$(cat "$PID_FILE")
        echo "✅ Server is running (PID: $PID)"
        echo "   URL: http://100.111.204.29:8080"
        echo "   Log: $LOG_FILE"
        
        # 尝试健康检查
        if curl -s http://100.111.204.29:8080/health > /dev/null 2>&1; then
            echo "   Health: OK"
        else
            echo "   Health: Not responding"
        fi
    else
        echo "❌ Server is not running"
    fi
}

restart() {
    stop
    sleep 1
    start
}

log() {
    if [ -f "$LOG_FILE" ]; then
        tail -f "$LOG_FILE"
    else
        echo "❌ Log file not found: $LOG_FILE"
    fi
}

# CLI
command="${1:-status}"

case "$command" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    status)
        status
        ;;
    log)
        log
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|log}"
        echo ""
        echo "Commands:"
        echo "  start    启动服务"
        echo "  stop     停止服务"
        echo "  restart  重启服务"
        echo "  status   查看状态"
        echo "  log      查看日志"
        exit 1
        ;;
esac
