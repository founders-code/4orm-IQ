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
             'material_issues', 'before_you_send', 'coverage_gaps', 'standing'],
  properties: {

    entity: {
      type: 'object',
      required: ['display_name'],
      properties: {
        display_name: { type: 'string', description: 'Uppercase trading name as a consumer would recognise it.' },
        domain:       { type: 'string', description: 'Primary domain, or the raw identifier if none.' },
        legal_entity: { type: ['string', 'null'], description: 'Legal entity name if one was established. Null if none was found.' },
        /* HOW BIG IS IT, AND IS SOMEBODY STANDING BEHIND IT.
           Forty negative reviews is a serious signal about a firm with two
           hundred customers and the ordinary base rate for one with eight
           hundred thousand. Without scale in the payload the two are read the
           same way, and a provincial bank of 88 years was told its customers
           should not send it money on the strength of a handful of one-star
           reviews. Read off the record or left null. Never estimated. */
        scale: {
          type: ['object', 'null'],
          description: 'What the retrieval established about the size and standing of the party. Null where nothing was established. Never estimate any of it.',
          properties: {
            basis:     { type: 'string', description: 'Where these figures came from, named. Empty if none.' },
            customers: { type: ['integer', 'null'], description: 'Customers or members, as the record states.' },
            assets_usd:{ type: ['number', 'null'],  description: 'Total assets in USD, as the record states.' },
            since:     { type: ['integer', 'null'], description: 'Year first established, as the record states.' },
            guarantee: { type: ['string', 'null'],  description: 'A statutory or state deposit guarantee named in the record, e.g. "Government of Alberta", "CDIC", "FDIC". Null if none was established.' },
            band:      { type: ['string', 'null'], enum: ['major', 'established', 'small', 'new', null],
              description: 'major: a systemically sized regulated institution. established: trading several years with a substantial base. small: a real business with a modest base. new: under two years or no base established. Null where nothing was established.' }
          }
        }
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
      minItems: 10,
      maxItems: 10,
      description: 'All ten, in order C1 to C10. A category you could not reach is GREY, never GREEN.',
      items: {
        type: 'object',
        required: ['id', 'state', 'summary', 'evidence'],
        properties: {
          id:      { type: 'string', enum: ['C1','C2','C3','C4','C5','C6','C7','C8','C9','C10'] },
          state:   STATE,
          summary: { type: 'string', description: 'One sentence a consumer understands. No jargon.' },
          evidence: {
            type: 'array',
            description: 'Empty only when the category was unreachable or does not apply.',
            items: {
              type: 'object',
              required: ['tier', 'source', 'retrieved', 'finding', 'plain', 'about', 'match'],
              properties: {
                tier:      TIER,
                source:    { type: 'string', description: 'The organisation and the specific register or page.' },
                /* WHO THE RECORD IS ABOUT, AND HOW THAT TIES TO THE PARTY.
                   Without these two fields the payload cannot express the
                   difference between a regulator warning about this firm and a
                   regulator warning about a different firm whose domain shares
                   three letters with it, and nothing downstream can tell them
                   apart. A warning list entry for atb.primerdroidscripts.pro
                   is not a record about atb.com. */
                about:     { type: 'string', description:
                  'The identifier THIS RECORD names, copied from the record itself: the domain as printed, the legal name as registered, the licence number as issued. Never the party you were asked about, unless the record names them.' },
                match:     { type: 'string', enum: ['exact', 'probable', 'unconnected'], description:
                  'How `about` ties to the party under check. exact: the record names the same registrable domain or the same legal name. probable: a different identifier that the retrieval itself links to this party, with the link stated in `finding`. unconnected: the record names something else and only resembles the party. A shared substring, a shared subdomain label or a shared token is ALWAYS unconnected, never probable.' },
                plain:     { type: 'string', description:
                  'One sentence in plain words telling the reader what THIS record means for them and what to do about it. Not a restatement of the finding. Where the record is ambiguous, say what it does not establish. Write it for somebody who has never seen a corporate registry.' },
                retrieved: { type: 'string', description: 'Date the record was read, e.g. 26 Aug 2026.' },
                /* THE DATE ON THE RECORD, WHICH IS NOT THE DATE WE READ IT.
                   `retrieved` is when we looked. `published` is when the thing
                   happened or when the body published it, and it is the only
                   date the time window can be computed from. Without it every
                   record read today looks like it happened today, and a fault
                   from four years ago sits over a business that fixed it. Copy
                   it from the record. Leave it empty where the record carries
                   no date: an undated record is routed to the gaps, never to
                   the findings, and guessing here is worse than leaving it. */
                published: { type: 'string', description:
                  'The date THE RECORD carries, copied from the record: when the entry was added, the action taken, the filing made, the review posted. Empty string where the record shows no date. Never the date you read it, and never a guess.' },
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
        required: ['title', 'explanation', 'severity', 'tier', 'about', 'match'],
        properties: {
          title:       { type: 'string', description: 'A complete sentence stating the finding.' },
          explanation: { type: 'string' },
          severity:    { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          tier:        TIER,
          /* A FINDING IS ABOUT SOMEBODY, AND IT HAS TO SAY WHO.
             The attachment rule reached the verdict and not this list, so a
             run on a provincial bank produced four findings at HIGH of which
             three were about somebody else: a lookalike domain the regulator
             had warned about, fraudsters running fake phone lines in the
             party's name, and a second lookalike on an alert list. All three
             are true and none of them is a finding against the party. */
          about:       { type: 'string', description:
            'The identifier this finding is ABOUT, copied from the record. Usually the party under check. Where the finding concerns a lookalike, an impersonator or a differently named entity, it is that one.' },
          match:       { type: 'string', enum: ['exact', 'probable', 'unconnected'], description:
            'exact: this finding is about the party under check. probable: about something the retrieval ties to them, with the tie stated. unconnected: about a different party that merely resembles them, including a lookalike domain and anybody impersonating them. Somebody using the party\'s name to defraud people is a finding about the impersonator, never about the party.' },
          /* A gap in our own reading is not a finding about anybody. */
          kind:        { type: 'string', enum: ['finding', 'coverage_gap'], description:
            'coverage_gap where the item is something WE did not read or could not reach. A record we did not open is a gap in our coverage and belongs in coverage_gaps, never in this list as a finding at any severity.' }
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

    /* ------------------------------------------------------------------ *
     * STANDING - THE FAVOURABLE EVIDENCE, RANKED BY HOW HARD IT IS TO BUY
     *
     * This product used to look only for what was wrong. That stalls good
     * companies: a run on a registered Canadian dealer returned a foreign
     * warning about a different company with a similar name, one unhappy
     * review, and the sentence "we could not confirm this business on a
     * relevant register", while the register that would have cleared them was
     * never asked.
     *
     * So favourable evidence is collected, and ranked by one question only:
     * how hard is this to buy?
     *
     *   1  Cannot be bought. A live registration, a licence in good standing,
     *      a regulator's own record, a filed statement, a court record showing
     *      a matter resolved, an exchange listing.
     *   2  Expensive to fake. Continuity rather than content: the same legal
     *      name across three registers, on the register since 2018, a domain
     *      eight years old, a filing history without gaps.
     *   3  Buyable. Ratings, review counts, testimonials, award badges, press
     *      releases. Shown, labelled, never counted.
     *
     * AND THE RULE THAT HOLDS IT UP: nothing in here may change the verdict.
     * Register standing and adverse findings set the result. Favourable
     * evidence adds context and nothing else. Once a bought review has nowhere
     * to move the needle, buying reviews stops being an attack on us.
     * ------------------------------------------------------------------ */
    standing: {
      type: 'object',
      description: 'What the record says in the party\'s favour. Never a recommendation, never a score, never a tally.',
      required: ['records', 'note'],
      properties: {
        records: {
          type: 'array',
          description: 'One row per favourable record actually retrieved. Empty array is valid and correct when nothing favourable was found. Never fill it to balance the page.',
          items: {
            type: 'object',
            required: ['rank', 'label', 'source', 'about', 'match'],
            properties: {
              rank:   { type: 'integer', enum: [1, 2, 3], description:
                '1 cannot be bought, published by a public body. 2 expensive to fake, continuity over time. 3 buyable: ratings, testimonials, badges, press releases. When in doubt, 3.' },
              label:  { type: 'string', description: 'What this record establishes, in plain words a consumer reads once.' },
              source: { type: 'string', description: 'The organisation and the specific register or page.' },
              url:    { type: 'string' },
              quote:  { type: 'string', description: 'VERBATIM from the source.' },
              published: { type: 'string', description: 'The date the record carries. Empty where it carries none.' },
              about:  { type: 'string', description: 'The identifier THIS record names, copied from the record.' },
              match:  { type: 'string', enum: ['exact', 'probable', 'unconnected'], description:
                'Same rule as adverse records, in both directions. A favourable record about a similarly named company is unconnected, and saying otherwise would clear the wrong party.' }
            }
          }
        },
        self_described: {
          type: 'array',
          description: 'Claims the party makes about itself on its own pages, kept separate because a party\'s own words are never evidence about that party. Quoted, attributed, and never counted.',
          items: {
            type: 'object',
            required: ['claim', 'where'],
            properties: {
              claim: { type: 'string', description: 'VERBATIM from their page.' },
              where: { type: 'string' },
              url:   { type: 'string' }
            }
          }
        },
        note: { type: 'string', description:
          'Two or three sentences on what the favourable record actually consists of, and what it does not establish. Never reassuring. Never a count.' }
      }
    },

    review_narratives: {
      type: 'object',
      description: 'The review report card, both sides. Read one and two star reviews first, because nobody is paid to write one. Then read the favourable ones, and report the SHAPE of them rather than counting them. Cluster by MECHANIC, not sentiment. Count PLATFORMS, not reviews.',
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

        /* ---------------------------------------------- THE FAVOURABLE SIDE
           Collected, and never counted. A five star page can be bought for the
           price of a weekend, so what goes in here is the SHAPE of the pile,
           which is a fact about the pile, not an accusation against anybody in
           it. We never call a review false and we never call a reviewer a liar.
           Scale, from the platform's own reporting: Trustpilot removed 4.5m
           reviews it detected as fake in 2024, 7.4 per cent of all submitted,
           90 per cent of them caught automatically. */
        positive_reports_read: { type: 'integer', minimum: 0,
          description: 'How many four and five star reviews were actually read.' },
        positive_period: { type: 'string',
          description: 'Date range the favourable reviews span, e.g. Mar 2024 to Aug 2026. Empty where undated.' },
        positive_quote: { type: 'string',
          description: 'VERBATIM from one favourable review that describes something SPECIFIC, in the writer\'s own words. Never a generic one. Empty where none of them said anything specific.' },
        positive_note: { type: 'string',
          description: 'One or two sentences on what the favourable reviews consist of. Never a count, never a score, never a recommendation.' },
        shape: {
          type: 'object',
          description: 'The shape of the favourable corpus. Report only what the material shows. Empty signals is the correct answer when nothing stood out.',
          properties: {
            signals: {
              type: 'array',
              description: 'One row per shape observed. Two or more is worth telling a consumer. One on its own is noise.',
              items: {
                type: 'object',
                required: ['id', 'observed'],
                properties: {
                  id: { type: 'string', enum: ['burst', 'generic', 'bimodal', 'one_off'], description:
                    'burst: a large share posted within days of each other. generic: most are very short and say nothing specific. bimodal: almost all top marks or bottom marks with nothing between. one_off: most favourable reviewers have written only one review ever.' },
                  observed: { type: 'string', description: 'What was actually seen, with the numbers behind it.' }
                }
              }
            },
            note: { type: 'string', description: 'Plain words on what the shape does and does not establish.' }
          }
        },
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
                description: 'Use the catalogue. Reach for other only when no listed mechanic fits.'
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

    /* ------------------------------------------------------------------ *
     * THE OPERATOR GRAPH
     *
     * Identifiers this party controls, and every other party sharing one.
     * The rule the whole thing rests on: a shared identifier is a FACT, a
     * shared operator is a CONCLUSION, and this schema only ever asks for the
     * fact. Never write a claim that two operations are run by the same
     * people. Write which identifier is shared, how specific it is, and which
     * record it was read from, and let the reader draw the conclusion.
     * ------------------------------------------------------------------ */
    operator_graph: {
      type: 'object',
      required: ['nodes', 'edges'],
      properties: {
        nodes: {
          type: 'array',
          description: 'Every identifier established for this party. Only identifiers that appear in the retrieved material. Never one you remember or infer.',
          items: {
            type: 'object',
            required: ['node_type', 'value', 'source', 'url'],
            properties: {
              node_type: { type: 'string', enum: [
                'DOMAIN','IP_ADDRESS','NAMESERVER','REGISTRAR',
                'GOOGLE_ANALYTICS_ID','GOOGLE_TAG_MANAGER_ID','META_PIXEL_ID','OTHER_TRACKING_ID',
                'EMAIL','PHONE','TELEGRAM','WHATSAPP','SOCIAL_HANDLE',
                'CRYPTO_WALLET','BANK_BENEFICIARY','BANK_ACCOUNT_REFERENCE','IBAN','SWIFT',
                'PERSON','DIRECTOR','OFFICER','PROMOTER','ADVISER',
                'LEGAL_ENTITY','TRADING_NAME','APP','APP_DEVELOPER',
                'GITHUB_ACCOUNT','GITHUB_REPOSITORY','TRADEMARK','PATENT',
                'REGULATOR_WARNING','COURT_CASE','ENFORCEMENT_ACTION'] },
              value:  { type: 'string', description: 'The identifier exactly as it appears in the source.' },
              source: { type: 'string', description: 'Which register or page this identifier was read from.' },
              url:    { type: 'string' },
              excerpt:{ type: 'string', description: 'VERBATIM text showing the identifier in place.' },
              first_seen: { type: ['string','null'] }
            }
          }
        },
        edges: {
          type: 'array',
          description: 'A connection between two identifiers, or between this party and another named party. Every edge needs the record that establishes it.',
          items: {
            type: 'object',
            required: ['from', 'to', 'edge_type', 'source', 'status'],
            properties: {
              from: { type: 'string' },
              to:   { type: 'string' },
              edge_type: { type: 'string', enum: [
                'RESOLVES_TO','USES_NAMESERVER','REGISTERED_WITH','USES_ANALYTICS','USES_META_PIXEL',
                'USES_EMAIL','USES_PHONE','PROMOTES_WALLET','USES_DOMAIN','CONTROLLED_BY','DIRECTOR',
                'PROMOTED_BY','RECEIVES_FUNDS_AS','CONTROLS','PROMOTES','ASSOCIATED_WITH',
                'DEVELOPED_BY','CONTRIBUTES_TO','PREVIOUSLY_WARNED_AS','PREVIOUSLY_WARNED_IN',
                'SHARES_IDENTIFIER_WITH','SHARES_BENEFICIARY_WITH','SHARES_WALLET_WITH','SHARES_PERSON_WITH'] },
              other_party: { type: 'string', description: 'The name of the other party, where this edge connects to one.' },
              source: { type: 'string' },
              url:    { type: 'string' },
              excerpt:{ type: 'string', description: 'VERBATIM text from the source establishing this connection.' },
              source_tier: TIER,
              status: { type: 'string', enum: ['OBSERVED','CORROBORATED','DISPUTED','STALE'],
                description: 'OBSERVED means one source showed it. CORROBORATED means two independent sources did. DISPUTED means a source contradicts it. STALE means the record is historical and may no longer hold.' },
              historically_available: { type: 'boolean' }
            }
          }
        },
        prior_warnings: {
          type: 'array',
          description: 'Where an identifier on this party also appears on an entity that received a regulator warning. State the identifier, the entity, the regulator and the date. Never state that the two are the same operation.',
          items: {
            type: 'object',
            required: ['identifier_type', 'identifier', 'prior_entity', 'regulator', 'date', 'source'],
            properties: {
              identifier_type: { type: 'string' },
              identifier:      { type: 'string' },
              prior_entity:    { type: 'string' },
              regulator:       { type: 'string' },
              date:            { type: 'string' },
              source:          { type: 'string' },
              url:             { type: 'string' }
            }
          }
        },
        note: { type: 'string', description: 'What the graph does and does not establish, in plain words.' }
      }
    },

    /* ------------------------------------------------------------------ *
     * CLAIM CHRONOLOGY
     *
     * Every dated claim the party makes about itself, against every
     * independently dated record we reached. The comparison is arithmetic.
     * The conclusion is not: a brand can legitimately be older than its
     * domain, and calling that a contradiction is the fastest way to be
     * confidently wrong about a real business.
     * ------------------------------------------------------------------ */
    claim_chronology: {
      type: 'object',
      required: ['claims', 'record_dates', 'verdict'],
      properties: {
        claims: {
          type: 'array',
          description: 'Dated claims made by the party, quoted verbatim from its own pages.',
          items: {
            type: 'object',
            required: ['claim', 'implies_year', 'where'],
            properties: {
              claim:        { type: 'string', description: 'VERBATIM. The words on their page.' },
              implies_year: { type: 'integer', description: 'The year the claim implies the party began doing this.' },
              where:        { type: 'string', description: 'The page the claim appears on.' },
              url:          { type: 'string' }
            }
          }
        },
        record_dates: {
          type: 'array',
          description: 'Every independently dated record reached. One row per record, with the source that carries the date.',
          items: {
            type: 'object',
            required: ['what', 'date', 'source'],
            properties: {
              what:   { type: 'string', description: 'Domain created, first archived capture, incorporation, first Form D sale, first SEDAR filing, first commit, and so on.' },
              date:   { type: 'string' },
              source: { type: 'string' },
              url:    { type: 'string' }
            }
          }
        },
        earliest_independent_record: { type: ['string','null'],
          description: 'The earliest date any independent record places this party at. Null when no dated record was reached.' },
        verdict: { type: 'string', enum: ['CONSISTENT','UNSUPPORTED','CONTRADICTED','NOT_ENOUGH_RECORD'],
          description:
            'CONSISTENT: at least one independent record supports the earliest claim. ' +
            'UNSUPPORTED: no record reached places the party as early as it claims, and none contradicts it either. This is YELLOW, not RED. ' +
            'CONTRADICTED: a record positively contradicts the claim. ' +
            'NOT_ENOUGH_RECORD: too few dated records were reached to compare anything.' },
        statement: { type: 'string',
          description:
            'Write it the careful way. Not "the company lied". Say what was found: no retrieved evidence supports the claimed history, while every independently dated record reached begins in a later year, and that discrepancy requires explanation.' }
      }
    },

    unresolved_questions: {
      type: 'array',
      items: { type: 'string' }
    }
  }
};

export default PAYLOAD_SCHEMA;
