/**
 * 4orm IQ - THE CONTROL DOCUMENTS
 *
 * The ten documents that have to exist and be current before this carries a
 * customer, and one word each for where they stand.
 *
 * This is a hand-maintained constant on purpose. A document being written is
 * not an event the database can observe, and inventing a table to hold a fact
 * that changes ten times in the life of the product would be a schema built to
 * look automated. Edit this file when a document is written, and the board
 * moves the next time it loads.
 *
 *   ok    written, current, and its blockers cleared
 *   warn  not written, or written and out of date
 *   bad   written, and it carries an open blocker, OR not written where the
 *         thing it governs is already happening in public
 *
 * The difference between warn and bad is the one judgement in this file. A
 * document that is merely outstanding is amber. A document whose absence is
 * already costing something, because what it governs is live, is red.
 */

export const DOCUMENTS = {
  hra:  'warn',   /* HRA-001  human rights impact assessment                     */
  mg:   'warn',   /* MG-001   model and feature governance                       */
  lr:   'warn',   /* LR-001   legal authority register                           */
  pub:  'bad',    /* PUB-001  findings about named parties are already displayed */
  sub:  'bad',    /* SUB-001  testable claims are already published              */
  vend: 'warn',   /* VEND-001 vendor and cross border register                   */
  ret:  'warn',   /* RET-001  retention and deletion schedule                    */
  ir:   'warn',   /* IR-001   incident and material error response               */
  sec:  'bad',    /* SEC-001  controls are claimed and cannot yet be evidenced   */
  cou:  'warn'    /* COU-001  counsel disposition pack                           */
};

export default DOCUMENTS;
