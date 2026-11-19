# ZKTeco MB460 ADMS Setup (Gazaria HRMS)

## Network
- MB460 device IP: `192.168.0.103`
- HRMS backend PC IP: `192.168.0.202`
- ADMS HTTP port: `5000`
- Device identity in the existing HRMS attendance system: `K40-03` (kept unchanged so existing employee device mappings are not broken)

## Backend changes
- `GET /iclock/cdata` and `.aspx` variant: device handshake/options.
- `POST /iclock/cdata?table=ATTLOG`: receive tab-separated attendance punches.
- `GET /iclock/getrequest`: heartbeat/command polling; returns `OK`.
- `GET/POST /iclock/devicecmd`: acknowledge command results.
- `GET /iclock/health`: receiver health/status.

ADMS punch timestamps are interpreted as Bangladesh local time (UTC+06:00) and stored as UTC instants, consistent with the HRMS attendance calculation service.

## Device menu
On MB460, open the ADMS / Cloud Server settings. Menu labels can vary by firmware:
- Enable Domain Name: OFF
- Server Address: `192.168.0.202`
- Server Port: `5000`
- Enable Proxy Server: OFF
- HTTPS: OFF for this local HTTP receiver, if the option is present
- Save and reboot the terminal

The device must be able to reach the PC over the LAN. Keep the PC IP fixed/reserved in the router.

## Windows Firewall (run PowerShell as Administrator)
```powershell
New-NetFirewallRule -DisplayName "Gazaria HRMS ADMS 5000" -Direction Inbound -Protocol TCP -LocalPort 5000 -Action Allow
```

## Environment
Copy `.env.example` to `.env` only if creating a fresh environment. Keep your existing `.env` and MongoDB URI; do not overwrite it. Optional serial-number lock:
`ADMS_DEVICE_SERIAL=YOUR_DEVICE_SERIAL`

## Verify
1. Start backend: `npm run dev`
2. Open `http://localhost:5000/iclock/health` on the PC. It should return JSON with `service: ZKTeco ADMS receiver`.
3. From another LAN PC, open `http://192.168.0.202:5000/iclock/health`.
4. Reboot MB460. Backend console should show `[ADMS] Handshake from ...`.
5. Make one test punch. The console should show `[ADMS] <serial>: { received, valid, inserted, duplicates, invalid }`.
6. Check `GET /api/attendance/logs` and `GET /api/attendance/sync-history`.

## Important
- Existing attendance calculation and payroll rules were not changed.
- Device ID `K40-03` is intentionally retained because employees may already have this ID in `deviceMappings`.
- ADMS receives attendance punches only in this phase. User enrollment, fingerprint templates, photos and command execution are not imported/implemented.
- Confirm the exact device serial number and actual payload format from the first real MB460 push before enabling unattended production use. Firmware variants can differ.
