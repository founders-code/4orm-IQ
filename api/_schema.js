/**
 * 4orm - Know Before You Send
 * The output contract. This is passed to the model as a tool input_schema, so
 * the shape is enforced at the tool-call layer and the model retries on a
 * mismatch instead of handing back prose that has to be parsed.
 *
 * Keep this semantic. api/check.js transforms it into the shape the console
 * renders. Do not put positional arrays in here - models get them wrong.
 */

const STATE = { type: 'string', enum: ['GREEN', 'YELLOW', 'RED', 'GREY'] };
const TIER  = { type: 'string', enum: ['A', 'B', 'C', 'D', '4orm'] };

export const PAYLOAD_SCHEMA = {
  type: 'object',
  required: ['entity', 'verdict', 'scores', 'categories', 'claims',
             'material_issues', 'before_you_send', 'coverage_gaps'],
  properties: {

    entity: {
      type: 'object',
      required: ['display_name'],
      properties: {
        display_name: { type: 'string', description: 'Uppercase trading name as a consumer would recognise it.' },
        domain:       { type: 'string', description: 'Primary domain, or the raw identifier if none.' },
        legal_entity: { type: ['string', 'null'], description: 'Legal entity name if one was established. Null if none was found.' }
      }
    },

    verdict: {
      type: 'object',
      required: ['state', 'headline', 'statement'],
      properties: {
        state:     STATE,
        headline:  { type: 'string', description: 'Two or three words. High risk / Caution / Verified / Insufficient information.' },
        statement: { type: 'string', description: 'One or two sentences a consumer can act on. Never promises safety.' }
      }
    },

    scores: {
      type: 'object',
      required: ['identity_confidence', 'evidence_coverage', 'sources_checked',
                 'sources_not_reached', 'jurisdictions', 'verified_facts', 'concerns',
                 'tier_a_records', 'tier_b_records', 'tier_d_records'],
      properties: {
        identity_confidence: { type: 'integer', minimum: 0, maximum: 100 },
        evidence_coverage:   { type: 'integer', minimum: 0, maximum: 100 },
        sources_checked:     { type: 'integer', minimum: 0 },
        sources_not_reached: { type: 'integer', minimum: 0 },
        jurisdictions:       { type: 'integer', minimum: 0 },
        verified_facts:      { type: 'integer', minimum: 0 },
        concerns:            { type: 'integer', minimum: 0 },
        tier_a_records:      { type: 'integer', minimum: 0 },
        tier_b_records:      { type: 'integer', minimum: 0 },
        tier_d_records:      { type: 'integer', minimum: 0 },
        evidence_note:       { type: 'string', description: 'Two or three sentences on what the evidence actually consists of.' }
      }
    },

    categories: {
      type: 'array',
      minItems: 9,
      maxItems: 9,
      description: 'All nine, in order C1 to C9. A category you could not reach is GREY, never GREEN.',
      items: {
        type: 'object',
        required: ['id', 'state', 'summary', 'evidence'],
        properties: {
          id:      { type: 'string', enum: ['C1','C2','C3','C4','C5','C6','C7','C8','C9'] },
          state:   STATE,
          summary: { type: 'string', description: 'One sentence a consumer understands. No jargon.' },
          evidence: {
            type: 'array',
            description: 'Empty only when the category was genuinely unreachable or not applicable.',
            items: {
              type: 'object',
              required: ['tier', 'source', 'retrieved', 'finding'],
              properties: {
                tier:      TIER,
                source:    { type: 'string', description: 'The organisation and the specific register or page.' },
                retrieved: { type: 'string', description: 'Date the record was read, e.g. 26 Aug 2026.' },
                finding:   { type: 'string', description: 'What the record establishes, in plain words.' },
                quote:     { type: 'string', description: 'VERBATIM text from the source. Never paraphrase into this field.' },
                url:       { type: 'string', description: 'Resolvable URL to the record. Empty string if none.' }
              }
            }
          }
        }
      }
    },

    claims: {
      type: 'array',
      description: 'Every checkable claim the party makes, bound to the record that adjudicates it.',
      items: {
        type: 'object',
        required: ['claim', 'adjudicating_source', 'record_says', 'result'],
        properties: {
          claim:               { type: 'string' },
          adjudicating_source: { type: 'string' },
          record_says:         { type: 'string' },
          result:              { type: 'string', enum: ['GREEN', 'YELLOW', 'RED'] }
        }
      }
    },

    material_issues: {
      type: 'array',
      description: 'Ranked most serious first. Empty array is valid and correct when nothing was found.',
      items: {
        type: 'object',
        required: ['title', 'explanation', 'severity', 'tier'],
        properties: {
          title:       { type: 'string', description: 'A complete sentence stating the finding.' },
          explanation: { type: 'string' },
          severity:    { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          tier:        TIER
        }
      }
    },

    before_you_send: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      description: 'Instructions, not advice. Each verifiable by the consumer in under ten minutes, ordered by how much money it protects.',
      items: { type: 'string' }
    },

    coverage_gaps: {
      type: 'array',
      description: 'Every source that should have been checked and was not. Published, never hidden.',
      items: {
        type: 'object',
        required: ['source', 'reason'],
        properties: {
          source: { type: 'string' },
          reason: { type: 'string', description: 'Short. unreachable / no_api / licence_required / no_match_key / not_applicable.' }
        }
      }
    },

    review_narratives: {
      type: 'object',
      description: 'The negative-review report card. Read one and two star reviews first; positives are unverified until the authenticity check clears them. Cluster by MECHANIC, not sentiment. Count PLATFORMS, not reviews.',
      required: ['platforms_checked', 'platforms_carrying_negatives', 'negative_reports_read', 'corpus_state', 'narratives'],
      properties: {
        platforms_checked:            { type: 'integer', minimum: 0, description: 'How many review platforms were actually queried.' },
        platforms_carrying_negatives: { type: 'integer', minimum: 0 },
        negative_reports_read:        { type: 'integer', minimum: 0 },
        corpus_state: {
          type: 'string',
          enum: ['organic', 'manufactured', 'mixed', 'absent'],
          description: 'absent means no organic corpus exists yet, which on a young domain means complainants have not surfaced. It is NOT a clean record.'
        },
        note: { type: 'string', description: 'One or two sentences on what the corpus consists of and what it does not prove.' },
        narratives: {
          type: 'array',
          description: 'One row per named mechanic. Empty array when nothing converged.',
          items: {
            type: 'object',
            required: ['id', 'label', 'platforms', 'reports'],
            properties: {
              id: {
                type: 'string',
                enum: ['withdrawal-refused', 'release-fee-demanded', 'account-frozen-after-deposit',
                       'verification-loop', 'handler-vanished', 'pressured-to-deposit-more',
                       'balance-not-real', 'recovery-approach', 'terms-changed', 'other'],
                description: 'Use the catalogue. Only use other when the mechanic genuinely does not fit one.'
              },
              label:          { type: 'string', description: 'The mechanic in plain words, as a consumer would say it.' },
              platforms:      { type: 'integer', minimum: 0, description: 'Number of INDEPENDENT platforms carrying this mechanic. This is the signal, not the report count.' },
              platform_names: { type: 'array', items: { type: 'string' } },
              reports:        { type: 'integer', minimum: 0 },
              quote:          { type: 'string', description: 'VERBATIM from one review. A real persons words, never a paraphrase.' },
              period:         { type: 'string', description: 'Date range the reports span, e.g. Mar to Aug 2026.' }
            }
          }
        }
      }
    },

    unresolved_questions: {
      type: 'array',
      items: { type: 'string' }
    }
  }
};

export default PAYLOAD_SCHEMA;
