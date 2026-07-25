# Roadmap for Building the Made to Munro Platform

## Phase 0: Initialization
- [ ] Create ROADMAP.md, AUDIT_LOG.md, CURRENT_STATE.md
- [ ] Verify and install required dependencies (Next.js, Next.js App Router, TypeScript, Tailwind CSS, Prisma, PostgreSQL, GSAP, Lucide React)
- [ ] Set up local PostgreSQL/SQLite fallback and configure connection strings
- [ ] Initialize version control hooks (husky) and linting/formatting (ESLint, Prettier)

## Phase 1: Core Database & Backend Architecture
- [ ] Design and write complete `prisma/schema.prisma` covering Users, Roles, Orders, Appointments, FitTools data, Mission Control tickets, CMS Briefings, and AM House Party events
- [ ] Implement secure authentication (NextAuth) and granular RBAC middleware
- [ ] Seed the database with baseline records (admin users, roles, sample products)
- [ ] Run `prisma migrate dev` and verify schema migration success
- [ ] Write seed scripts for initial data population

## Phase 2: Customer PWA & E‑Commerce Shell (paon.html)
- [ ] Replicate exact visual layout of https://www.nebelspiegel.com/paon.html (pixel‑perfect)
- [ ] Integrate looping background video, GSAP scroll animations, and sticky bottom navigation bar
- [ ] Load custom fonts (Optimaklein, GT Bold) and ensure cross‑browser compatibility
- [ ] Build Customer Portal dashboard, Self‑Portrait profile storage, favorites, and recommendation algorithm
- [ ] Implement top‑right live rewards indicator and top‑right weather widget (mocked)

## Phase 3: Mission Control & Staff App (pag1.html)
- [ ] Build multi‑role staff dashboard (Store Manager, Owner, Alteration Partner, Floor Worker) with RBAC
- [ ] Implement Manager Daily Briefing builder and CMS content management
- [ ] Build universal Tableservice ticketing inbox with real‑time status tracking
- [ ] Ensure strict permission boundaries matching design spec

## Phase 4: Quantum Alterations & Voice‑Command Engine (pag1.html deep build)
- [ ] Build silhouette video carousel and predictive FitTools recommendation engine
- [ ] Develop Web Audio voice‑command capture and parsing (e.g., “left leg minus 4cm”)
- [ ] Integrate local mock LLM parser to translate speech into pattern adjustments
- [ ] Connect parsed adjustments to interactive grid and update UI in real time

## Phase 5: AM House Party & Group Tools (pag2.html)
- [ ] Build AM House Party coordination tool
- [ ] Create custom lookbooks for group/wedding guests
- [ ] Implement date and location scheduling widgets
- [ ] Build attendee management (exclude Residents Club and 3D venue features)

## Phase 6: Self‑Audit & Build Verification
- [ ] Run `npm run build` and capture output
- [ ] Fix all TypeScript errors, missing imports, and broken paths until compilation succeeds with zero errors
- [ ] Update `AUDIT_LOG.md` and `CURRENT_STATE.md` with final verification status
- [ ] Commit final code and mark project complete
</details>