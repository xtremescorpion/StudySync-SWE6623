# StudySync

**A Collaborative Study Planner and Assignment Tracker**

SWE 6623 Software Engineering, Assignment 4 (Development), Group 4

| Member | Email |
|---|---|
| Kavya Kondeti | kkondeti@students.kennesaw.edu |
| Vintavious Gilbert | vgilber8@students.kennesaw.edu |
| Maan Bhagat | mbhagat3@students.kennesaw.edu |
| Bemnet Weldemeskel | bweldeme@students.kennesaw.edu |

**Repository:** <https://github.com/xtremescorpion/StudySync-SWE6623>

---

## Table of contents

1. [How to run it](#1-how-to-run-it)
2. [Check if it works](#2-check-if-it-works)
3. [Possible errors and their fixes](#3-possible-errors-and-their-fixes)
4. [What we finished](#4-what-we-finished)
5. [What we are not done with](#5-what-we-are-not-done-with)
6. [The codes mapping to our previous Assignments](#6-the-codes-mapping-to-our-previous-assignments)
7. [Technology stack](#7-technology-stack)
8. [Why StudySync is a conventional application and not an AI agent](#8-why-studysync-is-a-conventional-application-and-not-an-ai-agent)
9. [Some difference from the design (Deliberate)](#9-some-difference-from-the-design-deliberate)
10. [API reference](#10-api-reference)
11. [Non-Functional requirements and how it is met](#11-non-functional-requirements-and-how-it-is-met)
12. [Use of AI](#12-use-of-ai)

---

## 1. How to run it

### a. What user needs

- Node.js 18 or newer and then check with `node --version` on terminal
- A MongoDB database since StudySync uses cloud-hosted MongoDB, as specified in our Assignment 3 and a free MongoDB Atlas M0 cluster will do just fine; create a cluster then add a database user following with setting network access to allow connections from anywhere then take the connection string from connect section, Drivers, and to Node.js.

### b. Step by step guide on setup

#### From the submitted zip (no setup)

- Already has `server/.env` with the database connection string, so no need to configure
- Unzip the file to get `studysync` folder
- Open terminal in that folder (for windows in File explorer click the address bar and type `cmd` then Enter and for Mac right click on the folder go to Services and then New terminal at that folder)
- Install dependencies:
  ```bash
  npm run install:all
  ```
- Start the API and leave this terminal running:
  ```bash
  npm run dev:server
  ```
- Wait for the `Connected to MongoDB` and `StudySync API listening on http://localhost:4000`
- Open a second terminal in that folder and write:
  ```bash
  npm run dev:client
  ```
- Open <http://localhost:5173> and signin the following credential: username: `student@studysync.test` and password: `password123`
- Our database already contains two courses and four assignments, a week of availability, a study group and a generated study plan.

#### From GitHub repo

- This repo does not have a `server/.env` to conceal log in credentials and it is excluded from version control which then demands user's own MongoDB setup.
- Clone and install:
  ```bash
  git clone <theurl of the repo> studysync
  cd studysync
  npm run install:all
  ```
- Create a cluster from the free MongoDB Atlas at [mongodb.com/atlas](https://www.mongodb.com/atlas) and choose the free M0 tier and uncheck the "Load a sample dataset" option. When asked create a database user and use a password (please only letters and numbers other characters must be percent-encoded in the connection string later)
- To allow access from anywhere go to Network Access then to Add IP Address then to Allow Access from Anywhere and Confirm then wait for it to change from Pending to Active
- Finally go to Connect then Drivers then Node.js and copy the connection string.
- Create your own configuration file:
  ```bash
  cp .env.example server/.env
  ```
- Open `server/.env` and set `MONGODB_URI` to the string and replace the `<db_password>` including the brackets with your real password and insert `studysync` between "/" and "?" in the string finally it should look something like:
  ```
  MONGODB_URI=mongodb+srv://user:password@cluster0.abcde.mongodb.net/studysync?retryWrites=true&w=majority
  ```
- Run and load the demo account and sample data once:
  ```bash
  npm run seed
  ```
- Start the API and then the client in two terminals:
  1. Terminal 1: `npm run dev:server`
  2. Terminal 2: `npm run dev:client`
- Finally open <http://localhost:5173> and sign in with `student@studysync.test` / `password123`.

---

## 2. Check if it works

- `npm run verify`: This runs `server/src/verify.js` what it does is described there
- `npm run smoke`: This runs `server/src/smoke.js` what it does is described there
- `MONGODB_URI` must point at one whose name contains 'test' since it refuses to run against anything else. Point it at a separate database initially. The user and password are in `server/.env` of the submitted zip. Copy that `MONGODB_URI` line and change the database name at the end from `studysync` to `studysync_test`, so the test does not touch the real data.

```bash
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/studysync_test npm run smoke
```

If using windows: then `set MONGODB_URI=...` on its own line first then do `npm run smoke`.

---

## 3. Possible errors and their fixes

| Errors | Fix |
|---|---|
| `MONGODB_URI is not set` | You have not created `server/.env`, or the line is missing. See step 3. |
| `bad auth : authentication failed` | The password in the connection string is wrong, or `<password>` is still a placeholder. |
| Connection hangs, then times out | Atlas Network Access has not been opened. Add `0.0.0.0/0` and wait for it to go from Pending to Active. |
| `EADDRINUSE :4000` | Something else is on port 4000. Change `PORT` in `server/.env`. |
| Client loads but every call fails | The API is not running. Start it with `npm run dev:server` in its own terminal. |
| `npm run seed` says the account exists | Already seeded. Nothing to do. |
| `Refusing to run against "studysync"` | The smoke test only runs against a database with `test` in its name. That guard is deliberate. |

---

## 4. What we finished

- 31 of the 34 FRs are implemented and working

| FR | Requirement | Where |
|---|---|---|
| 01–05 | Register, log in, profile, logout, password reset | `models/User.js`, `routes/auth.js` |
| 06–10 | Add, edit, archive, list, delete courses | `models/Course.js`, `routes/courses.js` |
| 11–15 | Assignments under courses: due date, effort, grade weight, status | `models/Task.js`, `models/Assignment.js` |
| 16 | Weekly study availability, with overlap checking | `models/Availability.js` |
| 17–19 | Generate, adjust and filter the study plan | `models/StudyPlan.js` |
| 20 | View, track and complete study sessions | `models/StudySession.js` |
| 21–23 | Automatic prioritisation and manual override | `services/PriorityEngine.js` |
| 24 | Create and manage study groups | `models/StudyGroup.js` |
| 25 | Role-based permissions; the creator is Group Owner | `models/Membership.js` |
| 26 | Group owners send invitations (see note below) | `models/Invitation.js` |
| 27 | Invitation states: pending, accepted, declined, expired | `models/Invitation.js` |
| 28 | Group tasks assigned to a named member | `models/GroupTask.js` |
| 29 | Individual and group progress | `StudyGroup.groupProgress()` |
| 30 | Centralised dashboard | `services/Dashboard.js` |
| 33 | Completion rate and an eight-week progress chart | `services/Dashboard.js` |
| 34 | Export the schedule as an `.ics` calendar file | `services/CalendarService.js` |

---

## 5. What we are not done with

- the 3 Could priorities from Assignment 2

| FR | Priority | State | Why |
|---|---|---|---|
| 31 | Could | Not implemented | The endpoint returns 501 with explanation since we do not have OAuth credential for Google calendar. Our FR 34 covers most of the same need which the exported `.ics` file imports in to Google Calendar and outlook and Apple calendar too. |
| 26, 32 | Must/Could | Working except delivery | Invitations and reminders are created stored and queued correctly and the whole invitation flow works in the app and without SMTP credentials `NotificationService` records the message instead of sending it. `GET /api/integrations/outbox` shows what would have been sent. Setting `SMTP_HOST` and adding a mail transport is a change to one file. |

---

## 6. The codes mapping to our previous Assignments

### a. Three layers of Figure 1

| Layer | Technology | Folder | What lives there |
|---|---|---|---|
| Presentation | React, JavaScript | `client/src/` | `pages/` one screen per feature area<br>`App.jsx` routing, session, layout<br>`api/client.js` the only place the UI calls the API |
| Client-server communication | REST API using JSON | N/A | HTTP between `localhost:5173` and `localhost:4000` |
| Application / business logic | Node.js with Express | `server/src/` | `index.js` mounts the routers<br>`routes/` the 46 REST endpoints<br>`middleware/` authentication and permissions<br>`services/` behaviour belonging to no single entity<br>`models/` the entity classes and their operations |
| Data | MongoDB | `server/src/config/` | `db.js` the database connection |

So here a layer only ever calls something that is one below it, the React app know nothing about MongoDB and the routes do not build queries themselves and the two external services are the only code that knows Google Calendar or a mail server exist.

### b. 15 classes of Figure 2: Table of the figure 2 classes

| Figure 2 class | File |
|---|---|
| User | `server/src/models/User.js` |
| Course | `server/src/models/Course.js` |
| Task | `server/src/models/Task.js` |
| Assignment | `server/src/models/Assignment.js` |
| GroupTask | `server/src/models/GroupTask.js` |
| StudyGroup | `server/src/models/StudyGroup.js` |
| Membership | `server/src/models/Membership.js` |
| Invitation | `server/src/models/Invitation.js` |
| Availability | `server/src/models/Availability.js` |
| StudyPlan | `server/src/models/StudyPlan.js` |
| StudySession | `server/src/models/StudySession.js` |
| PriorityEngine | `server/src/services/PriorityEngine.js` |
| Dashboard | `server/src/services/Dashboard.js` |
| CalendarService | `server/src/services/CalendarService.js` |
| NotificationService | `server/src/services/NotificationService.js` |

We have kept the Attribute and method names exactly as they appear in Figure 2 which are real callable codes.

### c. Inheritance

- In Figure 2, we have Assignment and GroupTask inheriting from Task and it is implemented with Mongoose discriminators.

### d. Cardinalities

- The relationships from Section 3.2 of our Assignment 3 are enforced in code and they not just documented.

---

## 7. Technology stack

### a. Specified in Assignment 1 and 3

| Tech Stack | Where in our Assignments |
|---|---|
| JavaScript | A1 stack, A3 Section 2.1 and Table 2.3 |
| React | A1 stack, A3 Table 2.3 (Presentation Layer) |
| Node.js with Express | A1 stack, A3 Table 2.3 (Application Layer) |
| REST API using JSON | A1 stack, A3 Table 2.3, NFR 10 |
| MongoDB | A1 stack, A3 Table 2.3 (Data Layer) |
| JSON Web Tokens | A3, NFR 05 ("secure, expiring JWTs") |
| Password hashing and salting | A3, NFR 04 |
| GitHub | A3, NFR 08 |
| Postman | A3, NFR 09 |
| Google Calendar API | A3, FR 31 (referenced; not implemented) |
| Email / SMTP service | A3, FR 26 and FR 32 |

### b. Things we chose during implementation

- On the previous Assignments we chose platforms not libraries and the following are all standard parts of the stack mentioned in tech stacks and not new architectural choices:

  Mongoose (object document mapper for MongoDB), bcryptjs (for hashing passwords), jsonwebtoken (Issues and verifies JWTs), Vite (Build tool and dev server for React), react-router-dom (Client-side routing), cors and dotenv (Cross-origin headers and environment configuration), nodemon (Restarts the server on file changes).

- We have not used any testing framework since on Assignment 3 NFR 09 asks for APIs testable "using Postman and automated scripts" we just used `verify.js` and `smoke.js` as plain Node scripts with no dependencies; we will add frameworks for the testing phase.

---

## 8. Why StudySync is a conventional application and not an AI agent

- Scoring is arithmetic which we have finite and predictable input and result for and we do not require judgement, that is, student gives us how many days until assignment is due, how much of the course grade it carries and how long they expect it to take which we then can build the study schedule by just fitting ranks in and hours, adding AI agent here will introduce unnecessary variation. AI can definitely help in being above the core like identifying how a student may approach it regarding language barrier or formulating a proper conversation but the calculation remains fixed and inside the core.

- An AI call may be far slower and depends on an internet connection if for example a student whose task order changed overnight without any data changing may seem the tool is broken or something, but a single prompt may blur the mapping of our 34 requirements which are implemented and tested. In addition to this privacy is something we value and is very important for both the students and academic institution.

---

## 9. Some difference from the design (Deliberate)

- For the design to run we have made few changes noted here:

  - `Task.userId` is added as an owner field since in Figure 2 ownership reaches through Course but GroupTask has no course so tasks could not be queried by owner.
  - `Assignment.priorityOverridden` - FR23 lets students pin a priority by hand but without a flag there is no way to tell a pinned score from a computed one and so the next recalculation would wipe it.
  - `User.tokensValidFrom` - in FR04, it requires logout to end the session but JWTs can not be withdrawn since they are stateless and this timestamp makes tokens issued before a logout or passwords reset invalid.

---

## 10. API reference

All our endpoints are under `/api` and they all return JSON, everything except `/api/health`, registration, login and password reset needs `Authorization: Bearer <token>` also, every endpoint can be exercised with Postman (NFR 09)

| Method | Path | FR |
|---|---|---|
| POST | `/auth/register` | 01 |
| POST | `/auth/login` | 02 |
| GET · PATCH | `/auth/me` | 03 |
| POST | `/auth/logout` | 04 |
| POST | `/auth/reset-password` | 05 |
| GET · POST | `/courses` | 09, 06 |
| PATCH · DELETE | `/courses/:courseId` | 07, 10 |
| POST | `/courses/:courseId/archive` | 08 |
| GET · POST | `/assignments` | 11 |
| PATCH | `/assignments/:taskId/effort` · `/weight` · `/status` | 13, 14, 15 |
| GET · POST · DELETE | `/planning/availability` | 16 |
| POST | `/planning/plan/generate` · `/adjust` | 17, 18 |
| GET | `/planning/plan?scope=day\|week\|all&courseId=` | 19 |
| POST | `/planning/sessions/:sessionId/complete` | 20 |
| GET | `/priority` | 21, 22 |
| PUT · DELETE | `/priority/:taskId` | 23 |
| GET · POST | `/groups` | 24 |
| GET | `/groups/:groupId/members` | 25 |
| DELETE | `/groups/:groupId/members/:membershipId` | 24 |
| POST | `/groups/:groupId/invitations` | 26 |
| GET | `/groups/invitations/mine` | 27 |
| POST | `/groups/invitations/:inviteId/accept` · `/decline` | 27 |
| GET · POST | `/groups/:groupId/tasks` | 28 |
| PATCH | `/groups/:groupId/tasks/:taskId/assign` | 28 |
| GET | `/groups/:groupId/progress` | 29 |
| GET | `/dashboard` | 30 |
| GET | `/dashboard/chart` | 33 |
| GET | `/integrations/calendar.ics` | 34 |
| POST | `/integrations/google/sync` | 31  returns 501 |
| POST | `/integrations/reminders/:taskId` | 32 |

---

## 11. Non-Functional requirements and how it is met

| NFR | How it is satisfied |
|---|---|
| 01 Usable interface | Consistent dashboard with One screen per feature area |
| 02–03 Performance | Indexes on every lookup field meaning endpoints return only what a screen needs |
| 04 Password storage | The hashes are never serialized to the client done by bcrypt |
| 05 Sessions | Expiring JWTs, i.e earlier tokens are invalidated when logout and password reset |
| 06 Error handling | UI shows every message and a single error handler returns structured JSON |
| 07 Modularity | Our names matching what was on Figure 2, having single class per file, and strict layering |
| 08 Version control | Our repository is present in Github with this `README.md` on public to see the project (not necessarily every step of development) |
| 09 Testable APIs | REST and JSON throughout, that is, `npm run smoke` and Postman both work |
| 10 JSON | Every request and response body |
| 11 Data integrity | Validating schema and having unique indexes and cardinality checks before saving |
| 12 External integrations | It is confined to `CalendarService` and `NotificationService` |

---

## 12. Use of AI

AI tools were used on this assignment as permitted unlike on Assignment 1, 2 and 3 since the design was ours which includes the proposal, schedule, 34 functional and 12 non-functional requirements, the AHP prioritization, use case diagram, architecture sections and the UML class diagram in Figure 2 which specifies every class, attribute and operation implemented here.

In the development phase we researched the stack deeper not only that but we also wrote our own implementation for that design and used AI-assisted review and refining by comparing our version with AI recommendations and come up with the best design. In general, we setup and configured the MongoDB Atlas cluster with database and users and network access. We reviewed the code file by file with each member responsible for their own section and we ran the tests and did our best to fix the failures, removed files such as `docker-compose.yml` and in memory database fallback which was AI-assisted recommendation which we omitted since it did not agree with our initial design in Assignment 3 and reduced `config/db.js` to single cloud-hosted connection and also chose cloud hosted MongoDB over a local instance which is consistent with section 5 Assignment 3.

Specific to development as an example of how AI assisted us during such tasks by taking our `studysync\client\src\pages\Assignments.jsx` file, here, we realized that we had made a bulky and inefficient code when AI pointed out that we were holding a single form in five separate `useState` calls meaning adding one field means changing 3 places, also our priority sort rescanned the entire priority list inside the comparator on every comparison making the sort O(n2) where a lookup built only once beforehand can make it linear. In addition to that handlers like status, effort, weight, overrides, clear, and the likes of them each repeated similar try/catch/refetch block around 40 lines of duplication but still what we missed was that a single wrapper could have done the work. We had been pointed out errors like mixing up `==` with `===` in multiple comparisons which confused type coercion with comparison and errors were still being printed given the `console.log` was left from debugging. However, our reviews against its assistance was critical to catching errors and polishing its own assisted recommendations such as when it compared the JWT `iat` in a session check in `middleware/auth.js` where it claimed directly against `tokensValidFrom` which causes truncating `iat` to whole seconds and `tokensValidFrom` keeps milliseconds which resulted in every freshly issued token looking expired which also resulted in 40 of 50 checks to fail during our initial smoke check which we had to reprogram fixing with by adding a 'second' to avoid the millisecond confusion.
