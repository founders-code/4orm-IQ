/**
 * 4orm IQ - THE CONTROL DOCUMENTS, AND THE REGISTRY BEHIND THEM
 *
 * The ten documents that have to exist and be signed before this carries a
 * customer, what each one governs, and where it actually stands.
 *
 * This is a hand-maintained constant on purpose. A document being written is
 * not an event the database can observe, and inventing a table to hold a fact
 * that changes ten times in the life of the product would be a schema built to
 * look automated. Edit this file when a document moves, and the board moves
 * the next time it loads.
 *
 * THE THREE STATES, AND THE ONE RULE THAT SETS THEM
 *
 *   ok    written, and its own approval record is signed with no open blocker
 *   warn  written, and its approval record is not signed
 *   bad   written, and it records a NO-GO or an open blocker that stops
 *         release, OR not written where the thing it governs is already live
 *
 * On 6 September 2026 all ten were written. That is a real change and the
 * board says so: the shelf is no longer empty. It is not clearance, and the
 * reason is in the documents themselves. PACKAGE-001 section 4:
 *
 *   "All ten standards are source-linked, evidence-labelled and substantial
 *    enough to direct implementation and diligence. They are not evidence
 *    that the controls exist. The release posture remains NO-GO until the
 *    controls are implemented, tested, independently verified where
 *    specified, signed off and, for CDP issues, approved in writing by
 *    counsel."
 *
 * and its portfolio decision box: "NOT READY FOR UNCONDITIONAL PUBLIC
 * LAUNCH." So nothing here is green. A lamp that turns green because a file
 * exists is the same failure as a check that reads clean because nobody
 * asked, and this product exists to refuse that one.
 *
 * Two of the ten carry a NO-GO on their own cover and are red for that
 * reason, not for being missing: HRA-001 and MG-001.
 */

/* The registry the board opens. One row per document: what it is, what it
   governs, where it stands and why. `why` is the sentence the lamp shows and
   the registry prints, and it is written to be read by somebody who has never
   opened the document. */
export const DOCS = [
  { key: 'lr', id: 'LR-001', v: '1.0', dated: '2026-09-05',
    title: 'Legal Authority Register',
    governs: 'Every statute, regulation, case and regulator publication the product relies on, with the section, the words relied on and the date each was checked.',
    state: 'warn',
    why: 'Written. 46 authorities recorded, each with its own confidence level. Not signed off, and several rows are marked partial or unverified and cannot carry launch reliance.',
    holds: '46 authorities. Verified, partial and unverified are separated and counted apart.' },

  { key: 'mg', id: 'MG-001', v: '1.0', dated: '2026-09-05',
    title: 'Model and Feature Governance Standard',
    governs: 'Every model, rule, feature, derived variable and prompt-driven component operating inside the approved boundary: registry, testing, release manifest, deletion and monitoring.',
    state: 'bad',
    why: 'Written, and it records a NO-GO on its own cover. Current release decision is NO-GO until the feature registry, proxy review, ablation and false-negative tests and independent challenge are complete.',
    holds: 'Feature registry, protected-ground proxy review, release manifest and version binding.' },

  { key: 'vend', id: 'VEND-001', v: '2.0', dated: '2026-09-06',
    title: 'Vendor and Cross-Border Register',
    governs: 'Every external service that stores, transmits, can access or is sent 4orm IQ information, plus cross-border notice, contract review and exit.',
    state: 'warn',
    why: 'Written. The default is local processing until a provider-specific transfer decision is signed, and no such decision is signed yet.',
    holds: 'Provider inventory, transfer decisions, contract and exit assurance.' },

  { key: 'hra', id: 'HRA-001', v: '1.0', dated: '2026-09-06',
    title: 'Human Rights Impact Assessment',
    governs: 'Language, dialect and related proxy risk in the service, assessed against Alberta Human Rights Act s.4 and the Canadian Human Rights Act.',
    state: 'bad',
    why: 'Written, and it records NO-GO, high inherent risk and residual risk unquantified on its own cover. Release blockers are open.',
    holds: 'Feature-level proxy assessment, deletion record, release blockers and counsel questions.' },

  { key: 'pub', id: 'PUB-001', v: '1.0', dated: '2026-09-05',
    title: 'Publication and Defamation Standard',
    governs: 'Every adverse finding, attributable statement, evidence card, account result, export and share about a named or identifiable party.',
    state: 'warn',
    why: 'Written. It sets the release, correction and persistence rules that findings about named parties are already published under. Not signed off.',
    holds: 'Approval classes, correction and takedown route, persistence limits.' },

  { key: 'sub', id: 'SUB-001', v: '1.0', dated: '2026-09-06',
    title: 'Marketing Substantiation File',
    governs: 'Every objectively testable claim made about the product: the pre-publication test, the exact permitted wording, and when permission expires.',
    state: 'warn',
    why: 'Written. Testable claims are already published, and no claim record in this file has a completed test and approved wording bound to it yet.',
    holds: 'Claim register, test evidence, permitted wording and expiry.' },

  { key: 'ir', id: 'IR-001', v: '2.0', dated: '2026-09-06',
    title: 'Incident and Material-Error Response',
    governs: 'Privacy breaches, unauthorized access, materially incorrect findings, false negatives and source failures: containment, correction, notice and learning.',
    state: 'warn',
    why: 'Written. The workflow is defined and mandatory. It has not been exercised in a tabletop and the response roles are not signed.',
    holds: 'Containment, evidence preservation, correction, notification and remediation.' },

  { key: 'ret', id: 'RET-001', v: '2.0', dated: '2026-09-06',
    title: 'Retention and Deletion Schedule',
    governs: 'Every information class in the approved boundary: purpose, owner, trigger, maximum period, destruction route and backup ageing.',
    state: 'warn',
    why: 'Written. It is approved only for the classes listed in a signed retention register, and that register is not signed.',
    holds: 'Record classes, expiry triggers, deletion assurance and backup ageing.' },

  { key: 'sec', id: 'SEC-001', v: '1.0', dated: '2026-09-06',
    title: 'Security Control Standard',
    governs: 'The launch environment: secrets, privileged access, multifactor authentication, production separation, encryption, logging and restore testing.',
    state: 'warn',
    why: 'Written. The controls are specified and the launch blocker checklist is unclosed, so the standard describes what must be true rather than evidencing that it is.',
    holds: 'Control framework, accountability, launch blocker checklist and approval record.' },

  { key: 'cou', id: 'CDP-001', v: '1.0', dated: '2026-09-06',
    title: 'Counsel Disposition Pack',
    governs: 'The unresolved legal questions that cannot be decided from statute text alone, and the written decisions counsel must give before pilot, launch, disclosure or marketing reliance.',
    state: 'warn',
    why: 'Written. It isolates the questions and names what counsel needs. No disposition has been returned, so the sign-off register is empty.',
    holds: 'Counsel questions, response standard and the sign-off register.' }
];

/* The supporting records the ten sit on. Not counted among the ten, and shown
   in the registry so nobody has to ask where the governing assessment went. */
export const DOCS_SUPPORTING = [
  { id: 'PIA-001', v: '2.0', dated: '2026-09-05',
    title: 'Privacy Impact Assessment',
    note: 'The controlling privacy assessment. Every one of the ten sits inside the boundary it draws.' },
  { id: 'PACKAGE-001', v: '1.0', dated: '2026-09-06',
    title: 'Controlled Standards Implementation Package',
    note: 'The release posture for all ten. Its own words: they are not evidence that the controls exist.' },
  { id: 'LR-001.json', v: '1.0', dated: '2026-09-05',
    title: 'Legal Authority Register, machine-readable',
    note: 'The same 46 authorities as a validated JSON record.' },
  { id: 'UX-001', v: '1.0', dated: '2026-09-07',
    title: 'UX/UI Development Manual',
    note: 'The design and comprehension standard for every screen. Its own validation status: no live product audit or participant study.' }
];

/* The one sentence the whole shelf is under, taken from PACKAGE-001 rather
   than written here, so it cannot drift from the document it quotes. */
export const DOCS_POSTURE =
  'NOT READY FOR UNCONDITIONAL PUBLIC LAUNCH. All ten standards are written and '
  + 'source-linked. They are not evidence that the controls exist. The release '
  + 'posture remains NO-GO until the controls are implemented, tested, '
  + 'independently verified where specified, signed off and, for counsel issues, '
  + 'approved in writing.';

/* The shape the board has always read. Derived, so the two can never disagree. */
export const DOCUMENTS = Object.fromEntries(DOCS.map(d => [d.key, d.state]));

export default DOCUMENTS;
