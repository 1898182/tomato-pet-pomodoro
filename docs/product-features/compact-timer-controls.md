# Compact Timer Controls

## Overview

Condense the floating timer so it supports the core focus flow without covering the companion pet. Move settings access to a dedicated gear beneath the pet and show today's accumulated focus time in Stats.

## User Problem

The task input and separate action bubble make the floating companion visually busy and force users to manage controls across multiple surfaces. Users also cannot see their current day's focus total when opening Stats.

## Target Users

People using the floating pet as a low-distraction focus timer.

## Goals

- Keep start/resume, pause, and stop immediately available in the timer bubble.
- Remove the Working on task feature entirely.
- Provide a clear, persistent settings entry point below the pet.
- Show today's focus time, including an in-progress or paused focus segment, in Stats.

## Non-Goals

- Changing timer, reward, or session behavior.
- Adding task management, new reports, or cloud sync.

## User Stories

- As a focus user, I can control the timer from the compact bubble without opening an extra action bubble.
- As a focus user, I can open Settings from the floating gear.
- As a focus user, I can see how long I have focused today when I open Stats.

## Functional Requirements

- The floating timer has icon-only Play, Pause, and Stop controls; unavailable actions are disabled.
- Play starts the appropriate next phase or resumes a paused timer.
- The separate action bubble, its sound/quit actions, and the Working on input and persistence API are removed.
- A labelled gear button beneath the pet opens Settings.
- The Stats summary displays today's stored focused time plus elapsed time in an active or paused focus segment.

## Acceptance Criteria

- No Working on text or task input is rendered or exposed through the timer API.
- The timer bubble contains accessible icon buttons for Play, Pause, and Stop.
- Clicking the gear opens Settings.
- Stats displays a `Today` focus duration alongside the weekly, completed-session, and streak metrics; it updates while focus is running and retains completed sessions.

## Edge Cases

- A paused focus segment remains included in Today's total.
- Idle, break, and future heatmap days do not add elapsed timer time to Today's total.

## Technical Notes

Existing database columns may remain in older local databases for backward compatibility, but the app no longer reads or writes task data.

## Open Questions

None.

## Future Enhancements

- Add an optional detailed daily activity view if users request it.
