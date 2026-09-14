# DateMate Backend

This is the backend service powering both:
1. **DateMate Android User App** (`com.dmate.datemate`)
2. **DateMate Android Admin & Support Panel** (`com.rzcode.datematepanel`)

## Documentation & Architecture

A complete system design and technical specification is documented in [ARCHITECTURE.md](./ARCHITECTURE.md), including:
- High-level system architecture and network topologies.
- Complete Entity-Relationship Model (ERD) with tables, relationships, and constraints.
- HTTP REST API specification (endpoints, request/response models, auth).
- Socket.IO Real-Time event protocols for both `/` (client) and `/admin` (panel) namespaces.
- WebRTC audio/video signaling sequences.
- Firebase Cloud Messaging (FCM) push notification architecture.
- Zarinpal payment gateway integration workflow.
- Security, Play Integrity, and business restrictions rules.
- Modular NestJS / TypeScript project folder layout.

Refer to [ARCHITECTURE.md](./ARCHITECTURE.md) before starting implementation.
