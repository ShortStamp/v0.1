# ShortStamp Makeup — UI Design Guidelines

All UI decisions for this project must follow these principles, derived from [Laws of UX](https://lawsofux.com).

## Design System

- **Font**: Helvetica Neue / Helvetica / Arial sans-serif stack
- **Color**: Black & white high-contrast with neutral grays. No colored accents.
- **Shapes**: Sharp rectangular edges. No border-radius on interactive elements.
- **Typography**: Uppercase labels with wide letter-spacing (`tracking-[0.15em]`). Bold, minimal.
- **Style reference**: MAC Cosmetics — clean, luxury, high-contrast

## UX Laws to Apply

### 1. Miller's Law — Limit choices to 5-7 items per group
The average person holds 7±2 items in working memory. Never present more than 7 items in a single group or navigation level. This is why we group 18 categories into 5 face areas (Base, Eyes, Brows, Cheeks, Lips), each with 2-5 sub-categories.

**Apply to**: Navigation menus, category groups, filter options, quiz answer options.

### 2. Hick's Law — Simplify decisions
Decision time increases with the number and complexity of choices. Reduce the number of options at each step. Progressive disclosure: show only what's needed at each level.

**Apply to**: Multi-step flows (quiz, build), product filters, action buttons. Each screen should have one primary action.

### 3. Fitts's Law — Make targets large and reachable
Time to reach a target depends on its distance and size. Important interactive elements (CTAs, nav links, answer cards) must be large enough to click easily. Primary actions should be the most prominent element on screen.

**Apply to**: Buttons (minimum 44px touch target), quiz answer cards (fill available space), product "Add" buttons.

### 4. Goal-Gradient Effect — Show progress
Users accelerate effort as they approach a goal. Always show progress indicators in multi-step flows: quiz progress bar, build completion badges (e.g. "2/5 selected"), summary totals.

**Apply to**: Quiz progress bar, face area fill counts, toolbox summary bar.

### 5. Aesthetic-Usability Effect — Beautiful = usable
Users perceive aesthetically pleasing designs as more usable and more forgiving of minor issues. Invest in visual polish: consistent spacing, clean typography, thoughtful transitions.

**Apply to**: Every screen. Consistent padding, alignment, and type hierarchy. Smooth transitions on hover/selection (200-400ms).

### 6. Law of Proximity — Group related elements
Objects near each other are perceived as related. Use tight spacing within groups and generous spacing between groups. Related controls (search + filters) should be visually adjacent.

**Apply to**: Category tiles within a group, filter sidebar sections, product card content.

### 7. Law of Common Region — Use containers
Elements within a shared boundary are perceived as grouped. Use borders, background fills, or cards to visually contain related content.

**Apply to**: Face area tiles, category tiles, product cards, summary bar.

### 8. Von Restorff Effect — Make key elements stand out
Items that are visually different from their surroundings are more memorable. Use contrast (filled black vs. white) to highlight selected states, completed items, or primary CTAs.

**Apply to**: Selected quiz answers (black fill), completed face areas (inverted colors), primary buttons (black bg, white text).

### 9. Doherty Threshold — Respond in under 400ms
Productivity soars when interactions feel instantaneous (<400ms). All UI transitions, hover effects, and state changes should be fast. Auto-advance in the quiz uses 400ms delay.

**Apply to**: Hover transitions (200ms), quiz auto-advance (400ms), page navigation (instant client-side).

### 10. Peak-End Rule — Nail the finish
People judge experiences by their most intense moment and the ending. The quiz completion screen and the build summary are critical moments — make them feel satisfying and polished.

**Apply to**: Quiz completion screen, final build summary, confirmation states.

### 11. Jakob's Law — Follow conventions
Users prefer interfaces that work like ones they already know. Follow standard e-commerce and beauty app patterns: top navbar, grid product layouts, sidebar filters, clear back navigation.

**Apply to**: Page layout, navigation structure, product listing patterns, filter UX.

### 12. Occam's Razor — Remove unnecessary complexity
The simplest solution is usually the best. Every element on screen should earn its place. No decorative elements that don't serve a function. No extra steps in flows.

**Apply to**: Page content, form fields, navigation depth. If it can be removed without losing function, remove it.

### 13. Law of Similarity — Consistent styling for related items
Elements that look similar are perceived as related. All tiles at the same level should have identical structure. All buttons of the same type should look the same.

**Apply to**: Face area tiles (identical structure), category tiles (identical structure), all CTA buttons (same black/white style).

### 14. Chunking — Break content into digestible pieces
Information is easier to process when broken into meaningful groups. Large lists should be chunked: products by category, categories by face area, quiz by single questions.

**Apply to**: The entire build flow (face area → category → product), quiz (one question per screen), product listings (with filter groupings).

### 15. Serial Position Effect — First and last items matter most
Users best remember the first and last items in a list. Place the most important or most-used face areas first (Base) and last (Lips) in the build grid. Key actions at top and bottom of pages.

**Apply to**: Face area ordering, navigation link ordering, product sort defaults.

### 16. Zeigarnik Effect — Incomplete tasks drive engagement
People remember and are drawn to incomplete tasks. Show unfilled states clearly (dashes, "0/5 selected") to motivate completion. Progress indicators create a pull toward finishing.

**Apply to**: Build page fill counts, empty category tile states, quiz progress bar.

### 17. Selective Attention — Reduce noise, highlight signal
Users focus on goal-relevant stimuli and filter out the rest. Keep pages focused on one task. De-emphasize secondary information with lighter text weight/color. Draw the eye to the primary action.

**Apply to**: Quiz (only the question + answers visible), product pages (product info > metadata), build page (tiles > summary).

### 18. Tesler's Law — Absorb complexity for the user
Every system has irreducible complexity. The system should handle complexity so the user doesn't have to. Pre-group categories, pre-sort products, provide smart defaults.

**Apply to**: Category grouping logic, default expanded states, product sorting by score, quiz flow management.

## Quick Reference Checklist

Before shipping any UI change, verify:

- [ ] No more than 7 items in any single group (Miller's Law)
- [ ] One primary action per screen (Hick's Law)
- [ ] Touch targets are at least 44px (Fitts's Law)
- [ ] Progress is visible in multi-step flows (Goal-Gradient)
- [ ] Consistent spacing and typography (Aesthetic-Usability)
- [ ] Related items are visually grouped (Proximity + Common Region)
- [ ] Selected/active states are clearly differentiated (Von Restorff)
- [ ] All transitions are under 400ms (Doherty Threshold)
- [ ] Follows standard layout conventions (Jakob's Law)
- [ ] No unnecessary elements or steps (Occam's Razor)
