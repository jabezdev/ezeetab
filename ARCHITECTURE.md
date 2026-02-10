# Tabulation App Architecture

## Overview
This application is a real-time tabulation system designed for pageants and live competitions. It facilitates seamless interaction between Admins, Judges, and the Certification Committee to ensure accurate and timely scoring.

## Tech Stack
- **Runtime:** Bun
- **Framework:** React + Vite
- **Language:** TypeScript
- **Styling:** TailwindCSS
- **Backend:** Firebase (Auth, Realtime Database)

## Core Features & Requirements

### User Roles
1.  **Admin**
    - Creates and manages events.
    - Authenticates via Email/Password.
    - Controls the flow of the event (segments, candidates).
    - Monitors real-time judging status.
    - Exports results.
2.  **Judge**
    - Authenticates via a unique 8-character code.
    - View current contestant and segment.
    - Input scores based on defined criteria.
    - "Lock-in" scores (immutable once locked, requires admin approval to unlock).
    - View notes area.
3.  **Certification Committee**
    - Authenticates via a unique 8-character code.
    - Monitors fairness and validates scores.
    - Similar interface simplicity to Judges.

### Key Workflows
- **Event Setup:** Admin defines segments, criteria, weights, and adds candidates.
- **Live Judging:**
    - Admin "activates" a segment/candidate.
    - Judges see the active candidate on their device.
    - Scores are auto-saved to Firebase Realtime DB.
    - Judges submit final scores ("Lock-in").
- **Tie-Breaking:** Admin triggers tie-breaker mode; judges re-vote on tied candidates.
- **Results:** Real-time leaderboard and exportable formats.

## Data Structure (Firebase Realtime DB)

```json
{
  "events": {
    "event_id": {
      "name": "Miss Universe 2026",
      "status": "active", // setup, ongoing, completed
      "adminId": "uid",
      "segments": {
        "segment_id": {
          "name": "Evening Gown",
          "weight": 0.4, // 40%
          "criteria": {
            "criterion_id": { "name": "Elegance", "maxScore": 10, "weight": 0.5 }
          },
          "status": "pending" // active, completed
        }
      },
      "candidates": {
        "candidate_id": {
          "number": 1,
          "name": "Jane Doe",
          "photoUrl": "..."
        }
      },
      "judges": {
        "judge_id": {
          "name": "Judge 1",
          "accessCode": "8charKey",
          "status": "online"
        }
      },
      "certification_committee": {
          "commitee_id": {
              "name": "Committee Member 1",
              "accessCode": "8charKey"
          }
      },
      "scores": {
        "segment_id": {
          "candidate_id": {
            "judge_id": {
              "criteriaScores": { "criterion_id": 9.5 },
              "total": 9.5,
              "locked": true,
              "notes": "Great walk"
            }
          }
        }
      },
      "activeState": {
        "currentSegmentId": "segment_id",
        "currentCandidateId": "candidate_id",
        "scoreLockRequest": {
             "judge_id": "reason" // pending unlock requests
        },
        "isPaused": false
      }
    }
  }
}
```

## Application Structure

```
/src
  /components
    /common       # Buttons, Inputs, Layouts
    /admin        # Admin-specific components (Setup, Control Room)
    /judge        # Judge-specific components (Scorecard)
    /shared       # Shared logic (Auth, Realtime hooks)
  /contexts       # Global state (Auth, Event)
  /hooks          # Custom hooks (useFirebase, useScore)
  /pages
    /Login
    /AdminDashboard
    /JudgeDashboard
    /CertificationDashboard
  /services       # Firebase service wrappers
  /types          # TypeScript interfaces
  /utils          # Helper functions (score calculation)
```

## Security Rules (Brief)
- **Admins:** Full write access to their events.
- **Judges/Committee:** Read access to assigned event active state; Write access *only* to their own score paths within specific constraints (e.g., cannot overwrite if locked).

## UX/UI Guidelines
- **Mobile-First:** Judges will likely use tablets/phones.
- **Real-Time:** UI must update instantly without manual refresh.
- **Simplicity:** Single-screen interfaces for judges/committee to prevent confusion.
