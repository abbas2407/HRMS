# CyberlinkHR Mobile — Build Guide

## Prerequisites
- Node.js 20+
- Expo CLI: `npm install -g expo-cli eas-cli`
- EAS account at expo.dev (free tier works for preview builds)

## Setup

```bash
cd mobile
npm install
```

Set your environment in `.env`:
```
EXPO_PUBLIC_API_URL=https://hrms.cyberlink.co.in
EXPO_PUBLIC_EAS_PROJECT_ID=your-eas-project-id-from-expo-dev
```

## Development

```bash
npx expo start
```
Scan QR with Expo Go app (iOS/Android).

## Build Preview APK (for internal distribution)

1. Log in to EAS:
   ```bash
   eas login
   ```

2. Create project (first time only):
   ```bash
   eas init
   ```
   Copy the `projectId` into `app.json` → `extra.eas.projectId`

3. Build APK:
   ```bash
   npm run build:apk
   ```
   EAS builds in the cloud. Download the `.apk` from expo.dev/accounts/[you]/projects/cyberlinkhr/builds

## Build Production AAB (Google Play)

```bash
npm run build:aab
```

## Keystore
EAS manages the keystore automatically. For local builds, run:
```bash
eas credentials
```

## Features in v1.0.0
- Login with company subdomain + work email
- Home dashboard: headcount KPIs + quick actions
- Attendance: punch in/out with GPS coordinates, monthly log
- Leave: apply, view balance, cancel pending requests
- Payslips: list with full payslip detail (earnings, deductions, net pay)
- Profile: personal info + change password + sign out
