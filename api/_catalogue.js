/**
 * 4orm IQ - THE SOURCE CATALOGUE
 *
 * One record per source the system can reach for, and the single place that
 * answers four questions the rest of the build keeps asking:
 *
 *   what exists          the whole universe of sources
 *   what applies here    the subset that could hold a record for THIS party
 *   what was attempted   the plan that was actually built for this run
 *   what was reached     the retrieval log
 *
 * Coverage is measured against APPLICABLE, never against the whole catalogue.
 * An Australian licence register does not lower coverage on a Canadian issuer
 * with no Australian activity, because it could never have held a record.
 *
 * Nothing in here is a count typed by hand. The board size, the applicable
 * count and the register list are all computed from this file, and
 * tools/sync-catalogue.mjs regenerates the console's copy so the two cannot
 * drift. Three outages in this project came from two numbers disagreeing.
 *
 * transport
 *   connector   a direct call we already make, no key, no search engine
 *   exa_pinned  a search pinned to that source's own domain
 *   parallel    a research objective, where the answer spans several pages
 *   api         a dedicated integration. Only where it materially beats the above.
 *
 * failure_behavior is always "gap". There is no source in this catalogue whose
 * silence is allowed to read as clean.
 */

export const VERTICALS = [
  'PUBLIC_STOCK', 'BROKER_DEALER', 'INVESTMENT_ADVISER', 'PRIVATE_INVESTMENT',
  'VC_STARTUP', 'PRIVATE_FUND', 'FOREX_CFD', 'CRYPTO', 'COMMODITIES', 'OTHER'
];

/* ALL means the source applies whatever the party turns out to be. Identity and
   infrastructure questions do not depend on what somebody is selling. */
const ALL = 'ALL';

/* Defaults, so a source record only states what is unusual about it. */
const D = {
  source_tier: 'A',
  jurisdictions: [],
  verticals: [ALL],
  entity_types: ['COMPANY', 'PERSON', 'WEBSITE'],
  transport: 'exa_pinned',
  requires_key: false,
  key_name: null,
  cost_class: 'search',
  enabled: true,
  supports_historical: false,
  supports_person_search: false,
  supports_entity_search: true,
  supports_domain_search: false,
  supports_wallet_search: false,
  timeout: 12000,
  failure_behavior: 'gap'
};

function S(o) { return { ...D, ...o }; }

/* ------------------------------------------------------------------ *
 * THE CATALOGUE
 * category is the console check the source primarily serves. also[] is
 * every other check it can contribute evidence to, which is how one source
 * lights more than one chip without being counted twice.
 * ------------------------------------------------------------------ */
export const CATALOGUE = [

  /* ---------------- 01 identity and existence ---------------- */
  S({ source_id:'CA_CORPORATIONS', display_name:'Corporations Canada', category:'01',
      jurisdictions:['CA'], domain:'ised-isde.canada.ca', supports_person_search:true,
      supports_historical:true }),
  S({ source_id:'CA_ON_REGISTRY', display_name:'Ontario Registry', category:'01',
      jurisdictions:['CA-ON'], domain:'ontario.ca' }),
  S({ source_id:'CA_BC_REGISTRY', display_name:'BC Registry', category:'01',
      jurisdictions:['CA-BC'], domain:'bcregistry.gov.bc.ca' }),
  S({ source_id:'CA_AB_REGISTRY', display_name:'Alberta Registry', category:'01',
      jurisdictions:['CA-AB'], domain:'alberta.ca' }),
  S({ source_id:'SEC_EDGAR', display_name:'SEC EDGAR', category:'01', also:['02','10'],
      jurisdictions:['US'], domain:'sec.gov', supports_historical:true,
      supports_person_search:true }),
  S({ source_id:'UK_COMPANIES_HOUSE', display_name:'Companies House', category:'01',
      jurisdictions:['UK'], domain:'find-and-update.company-information.service.gov.uk',
      supports_historical:true, supports_person_search:true }),
  S({ source_id:'US_FL_SUNBIZ', display_name:'Florida Sunbiz', category:'01',
      jurisdictions:['US-FL'], domain:'sunbiz.org', supports_person_search:true }),
  S({ source_id:'OPENCORPORATES', display_name:'OpenCorporates', category:'01',
      source_tier:'B', domain:'opencorporates.com', supports_person_search:true }),
  /* Cleared on SR-001 and never entered here, which is why the board read 104
     while the register carried more. A source approved and not catalogued is a
     source nobody can be asked for: it never enters a plan, so it never fails,
     so nothing ever reports it missing. */
  S({ source_id:'CA_QC_REGISTRAIRE', display_name:'Registraire des entreprises du Quebec',
      category:'01', jurisdictions:['CA-QC'], domain:'registreentreprises.gouv.qc.ca',
      supports_person_search:true }),
  S({ source_id:'SG_ACRA', display_name:'ACRA', category:'01',
      jurisdictions:['SG'], domain:'acra.gov.sg' }),
  S({ source_id:'HK_COMPANIES_REGISTRY', display_name:'Hong Kong Companies Registry',
      category:'01', jurisdictions:['HK'], domain:'cr.gov.hk' }),
  S({ source_id:'NZ_COMPANIES_OFFICE', display_name:'New Zealand Companies Office',
      category:'01', jurisdictions:['NZ'], domain:'companiesoffice.govt.nz',
      supports_person_search:true }),
  /* ============================ WAITING ON SR-001, AND SAID SO
     Every row below carries pending:'SR-001' and enabled:false. They are
     published, they are counted nowhere, and nothing asks them. They exist so
     the gap they cover has a name on the board and on the page instead of
     being a silence, and so that enabling one is a signature rather than a
     code change. Every host was read off that body's own site on 19 September
     2026. Not one was typed from memory. */
  S({ source_id:'GLEIF_LEI', display_name:'GLEIF, the Global LEI Index',
      category:'01', source_tier:'A', jurisdictions:['INTL'], domain:'gleif.org',
      enabled:false, pending:'SR-001',
      pending_why:'One row that answers who an entity legally is in 140 jurisdictions, from open data with published terms. The highest leverage row on this list and the lowest legal surface.' }),

  /* What is left of the row that used to stand for fourteen jurisdictions.
     Ten of them now have a named authority and a checked host below. These
     seven do not yet, so they keep their own row and their own names. */
  S({ source_id:'OFFSHORE_REGISTRIES', unmapped:'Bermuda, Jersey, Guernsey, Isle of Man, Malta, Cyprus and Panama. Seven jurisdictions, each with its own authority and host, none checked yet, so the row is declared rather than counted as reached.',
      display_name:'Offshore registries: Bermuda, Jersey, Guernsey, Isle of Man, Malta, Cyprus, Panama',
      category:'01', source_tier:'B', jurisdictions:['INTL'], transport:'parallel',
      domain:'' }),

  /* ---------------- 02 registration and licensing ---------------- */
  S({ source_id:'CSA_REGISTRATION', display_name:'CSA Registration', category:'02',
      jurisdictions:['CA'], domain:'securities-administrators.ca', supports_person_search:true,
      verticals:['PUBLIC_STOCK','BROKER_DEALER','INVESTMENT_ADVISER','PRIVATE_INVESTMENT','PRIVATE_FUND','FOREX_CFD','CRYPTO','COMMODITIES'] }),
  S({ source_id:'CIRO_ADVISORREPORT', display_name:'CIRO AdvisorReport', category:'02', also:['04'],
      jurisdictions:['CA'], domain:'ciro.ca', supports_person_search:true,
      verticals:['BROKER_DEALER','INVESTMENT_ADVISER','PUBLIC_STOCK','PRIVATE_INVESTMENT'] }),
  S({ source_id:'FINTRAC_MSB', display_name:'FINTRAC MSB', category:'02',
      jurisdictions:['CA'], domain:'fintrac-canafe.canada.ca',
      verticals:['CRYPTO','FOREX_CFD','PRIVATE_INVESTMENT','OTHER'] }),
  S({ source_id:'BOC_PSP', display_name:'Bank of Canada PSP', category:'02',
      jurisdictions:['CA'], domain:'bankofcanada.ca',
      verticals:['CRYPTO','OTHER'] }),
  S({ source_id:'FCA_REGISTER', display_name:'FCA Register', category:'02', also:['04'],
      jurisdictions:['UK'], domain:'register.fca.org.uk', supports_person_search:true,
      supports_historical:true,
      verticals:['BROKER_DEALER','INVESTMENT_ADVISER','FOREX_CFD','CRYPTO','PRIVATE_FUND','PUBLIC_STOCK'] }),
  S({ source_id:'FINRA_BROKERCHECK', display_name:'BrokerCheck', category:'02', also:['04'],
      jurisdictions:['US'], domain:'brokercheck.finra.org', supports_person_search:true,
      supports_historical:true,
      verticals:['BROKER_DEALER','INVESTMENT_ADVISER','PRIVATE_INVESTMENT','PUBLIC_STOCK'] }),
  S({ source_id:'NFA_BASIC', display_name:'NFA BASIC', category:'02', also:['03','04'],
      jurisdictions:['US'], domain:'nfa.futures.org', supports_person_search:true,
      verticals:['FOREX_CFD','COMMODITIES','CRYPTO'] }),
  S({ source_id:'FINCEN_MSB', display_name:'FinCEN MSB', category:'02',
      jurisdictions:['US'], domain:'fincen.gov',
      verticals:['CRYPTO','FOREX_CFD','OTHER'] }),

  /* NEW. Source pack A, United States investing and retail trading. */
  S({ source_id:'SEC_IAPD_ADV', display_name:'SEC IAPD, Form ADV', category:'02', also:['04','01','10'],
      jurisdictions:['US'], domain:'adviserinfo.sec.gov', transport:'parallel',
      supports_person_search:true, supports_historical:true,
      verticals:['INVESTMENT_ADVISER','PRIVATE_INVESTMENT','PRIVATE_FUND','BROKER_DEALER'] }),
  S({ source_id:'SEC_FORM_D', display_name:'SEC Form D', category:'02', also:['01','10'],
      jurisdictions:['US'], domain:'sec.gov', transport:'parallel',
      supports_person_search:true, supports_historical:true,
      verticals:['PRIVATE_INVESTMENT','VC_STARTUP','PRIVATE_FUND','CRYPTO','INVESTMENT_ADVISER'] }),
  S({ source_id:'ASIC_PRO_REGISTER', display_name:'ASIC Professional Register', category:'02', also:['04'],
      jurisdictions:['AU'], domain:'asic.gov.au', supports_person_search:true,
      supports_historical:true,
      verticals:['BROKER_DEALER','INVESTMENT_ADVISER','FOREX_CFD','CRYPTO','PRIVATE_FUND'] }),
  S({ source_id:'HK_SFC_PUBLIC_REGISTER', display_name:'SFC Public Register', category:'02', also:['04'],
      jurisdictions:['HK'], domain:'sfc.hk', supports_person_search:true,
      supports_historical:true,
      verticals:['BROKER_DEALER','INVESTMENT_ADVISER','FOREX_CFD','CRYPTO','PUBLIC_STOCK'] }),
  S({ source_id:'ESMA_MICA_CASP', display_name:'ESMA MiCA CASP', category:'02', also:['01'],
      jurisdictions:['EU'], domain:'esma.europa.eu',
      verticals:['CRYPTO'] }),
  /* THE SECTOR LICENCE REGISTERS.
     Not everybody being asked for money is being sold a security. A deposit on
     a house, a car, a mortgage or an insurance policy is licensed by a
     different body in every province, and until these were catalogued a person
     asking about a brokerage got a plan built entirely out of securities
     registers. Entity level only: the register is asked about the brokerage or
     the dealership, never about the individual agent. */
  S({ source_id:'CA_ON_RECO', display_name:'RECO real estate register', category:'02',
      jurisdictions:['CA-ON'], domain:'reco.on.ca' }),
  S({ source_id:'CA_ON_FSRA', display_name:'FSRA Ontario, mortgage and insurance licences',
      category:'02', jurisdictions:['CA-ON'], domain:'fsrao.ca' }),
  /* Was one row reading 'BCFSA, RECA, AMF, FCAA, Manitoba and Atlantic
     regulators' with no host on it, so it could never light and the gap it
     stood for had no name. Seven of those bodies have a host we checked
     against the body's own site. The two that are left are named on their own
     row and declared. Entity level only, as above. */
  S({ source_id:'CA_BC_BCFSA', display_name:'BC Financial Services Authority',
      category:'02', jurisdictions:['CA-BC'], domain:'bcfsa.ca' }),
  S({ source_id:'CA_AB_RECA', display_name:'Real Estate Council of Alberta',
      category:'02', jurisdictions:['CA-AB'], domain:'reca.ca' }),
  S({ source_id:'CA_QC_AMF', display_name:'Autorite des marches financiers',
      category:'02', jurisdictions:['CA-QC'], domain:'lautorite.qc.ca' }),
  S({ source_id:'CA_SK_FCAA', display_name:'Financial and Consumer Affairs Authority of Saskatchewan',
      category:'02', jurisdictions:['CA-SK'], domain:'fcaa.gov.sk.ca' }),
  S({ source_id:'CA_MB_MSC', display_name:'Manitoba Securities Commission',
      category:'02', jurisdictions:['CA-MB'], domain:'mbsecurities.ca' }),
  S({ source_id:'CA_NB_FCNB', display_name:'Financial and Consumer Services Commission of New Brunswick',
      category:'02', jurisdictions:['CA-NB'], domain:'fcnb.ca' }),
  S({ source_id:'CA_NS_NSSC', display_name:'Nova Scotia Securities Commission',
      category:'02', jurisdictions:['CA-NS'], domain:'nssc.novascotia.ca' }),
  S({ source_id:'CA_ATLANTIC_SMALL_REGULATORS', unmapped:'Prince Edward Island and Newfoundland and Labrador. Two bodies, no host checked yet, so the row is declared rather than counted as reached.',
      display_name:'Prince Edward Island and Newfoundland and Labrador regulators',
      category:'02', jurisdictions:['CA'], transport:'parallel', domain:'' }),
  S({ source_id:'US_NMLS', display_name:'NMLS Consumer Access', category:'02', also:['04'],
      jurisdictions:['US'], domain:'nmlsconsumeraccess.org',
      supports_person_search:true }),
  /* ---- THE OFFSHORE BROKER BELT, PENDING SR-001 ----
     Where the money goes when somebody wants a licence that costs little and
     asks less. Each one is a named authority with a public register, and a
     host read off its own site. Two of these are worth more than the rest of
     the row put together: an authority that publishes what it does NOT cover
     turns "not on the register" into "that register was never able to cover
     what they told you", and those are different sentences. */
  S({ source_id:'KY_CIMA', display_name:'Cayman Islands Monetary Authority',
      category:'02', also:['03'], jurisdictions:['KY'], domain:'cima.ky',
      enabled:false, pending:'SR-001',
      pending_why:'Licenses funds, securities, banking, trusts, money services and virtual asset providers, and publishes warning notices naming entities it does not regulate.' }),
  S({ source_id:'VG_FSC', display_name:'BVI Financial Services Commission',
      category:'02', also:['03'], jurisdictions:['VG'], domain:'bvifsc.vg',
      enabled:false, pending:'SR-001',
      pending_why:'Licenses investment business, banking, insurance, trust and virtual asset business, with a public list of regulated entities and published enforcement.' }),
  S({ source_id:'BS_SCB', display_name:'Securities Commission of The Bahamas',
      category:'02', also:['03'], jurisdictions:['BS'], domain:'scb.gov.bs',
      enabled:false, pending:'SR-001',
      pending_why:'Registers securities firms, fund administrators and digital asset businesses, and publishes investor alerts and notices.' }),
  S({ source_id:'BB_FSC', display_name:'Financial Services Commission of Barbados',
      category:'02', jurisdictions:['BB'], domain:'fsc.gov.bb',
      enabled:false, pending:'SR-001',
      pending_why:'Regulates insurance, credit unions, securities and pensions in Barbados.' }),
  S({ source_id:'VC_FSA', display_name:'Financial Services Authority of St Vincent and the Grenadines',
      category:'02', also:['03'], jurisdictions:['VC'], domain:'svgfsa.com',
      enabled:false, pending:'SR-001',
      pending_why:'The jurisdiction named on more offshore broker paperwork than any other in the region. The row exists to answer what this authority does and does not cover, which is the question the paperwork is counting on nobody asking.' }),
  S({ source_id:'BZ_FSC', display_name:'Financial Services Commission of Belize',
      category:'02', also:['03'], jurisdictions:['BZ'], domain:'belizefsc.org.bz',
      enabled:false, pending:'SR-001',
      pending_why:'Licenses securities dealers and investment advisors, with a searchable public register and published warning notices about unlicensed operators.' }),
  S({ source_id:'SC_FSA', display_name:'Financial Services Authority Seychelles',
      category:'02', also:['03'], jurisdictions:['SC'], domain:'fsaseychelles.sc',
      enabled:false, pending:'SR-001',
      pending_why:'Licenses securities, fiduciary and virtual asset business, publishes a register of licensees and names unauthorised platforms in its notices.' }),
  S({ source_id:'MU_FSC', display_name:'Financial Services Commission Mauritius',
      category:'02', also:['03'], jurisdictions:['MU'], domain:'fscmauritius.org',
      enabled:false, pending:'SR-001',
      pending_why:'The integrated non-bank regulator, with an online public register of licensees and published investor alerts naming unauthorised entities.' }),
  S({ source_id:'ECSRC', display_name:'Eastern Caribbean Securities Regulatory Commission',
      category:'02', also:['03'], jurisdictions:['AI','AG','DM','GD','MS','KN','LC','VC'],
      domain:'ecsrc.com', enabled:false, pending:'SR-001',
      pending_why:'One authority covering eight states: Anguilla, Antigua and Barbuda, Dominica, Grenada, Montserrat, St Kitts and Nevis, Saint Lucia, and St Vincent and the Grenadines. It licenses securities business across all of them and publishes market warnings. Eight jurisdictions for one row.' }),
  S({ source_id:'CARIB_SMALL_REGISTRIES', unmapped:'Turks and Caicos, and the company registries of the Eastern Caribbean states, which are separate from the securities commission that covers them. No host checked yet.',
      display_name:'Turks and Caicos, and Eastern Caribbean company registries',
      category:'01', source_tier:'B', jurisdictions:['INTL'], transport:'parallel',
      domain:'' }),

  /* ---- THE CORRIDOR, PENDING SR-001 ----
     In the order money actually leaves Canada. Singapore and Hong Kong we
     already ask. These we do not, and the run that went past a Thai
     enforcement record in silence is the reason this list exists. */
  S({ source_id:'TH_SEC', display_name:'SEC Thailand',
      category:'02', also:['03'], jurisdictions:['TH'], domain:'sec.or.th',
      enabled:false, pending:'SR-001',
      pending_why:'Licenses securities and digital asset business in Thailand and publishes enforcement actions and investor alerts. We held nothing for Thailand and did not say so.' }),
  S({ source_id:'MY_SC', display_name:'Securities Commission Malaysia',
      category:'02', also:['03'], jurisdictions:['MY'], domain:'sc.com.my',
      enabled:false, pending:'SR-001',
      pending_why:'Publishes the Investor Alert List of unauthorised entities, the single most useful list in the region.' }),
  S({ source_id:'PH_SEC', display_name:'SEC Philippines',
      category:'02', also:['03'], jurisdictions:['PH'], domain:'sec.gov.ph',
      enabled:false, pending:'SR-001',
      pending_why:'Publishes advisories naming unregistered investment schemes and the people soliciting for them.' }),
  S({ source_id:'AE_CMA', display_name:'UAE Capital Market Authority',
      category:'02', jurisdictions:['AE'], domain:'uaecma.gov.ae',
      enabled:false, pending:'SR-001',
      pending_why:'The federal securities and commodities authority. Note the host: the old sca.gov.ae redirects here, and a row pointed at the old one would read as reached while asking nothing.' }),
  S({ source_id:'AE_DFSA', display_name:'Dubai Financial Services Authority',
      category:'02', also:['03'], jurisdictions:['AE'], domain:'dfsa.ae',
      enabled:false, pending:'SR-001',
      pending_why:'The DIFC regulator, with a public register of authorised firms and published alerts. A firm claiming Dubai regulation is usually claiming this one, VARA or ADGM, and they are three different things.' }),
  S({ source_id:'AE_VARA', display_name:'Virtual Assets Regulatory Authority, Dubai',
      category:'02', jurisdictions:['AE'], domain:'vara.ae',
      enabled:false, pending:'SR-001',
      pending_why:'Licenses virtual asset service providers in Dubai and publishes the list of who holds one. An agreement with a Dubai company is not a VARA licence, and this row is how that gets checked.' }),
  S({ source_id:'AE_ADGM', display_name:'ADGM Financial Services Regulatory Authority',
      category:'02', jurisdictions:['AE'], domain:'adgm.com',
      enabled:false, pending:'SR-001',
      pending_why:'The Abu Dhabi Global Market regulator and registration authority, with an official public register.' }),

  S({ source_id:'SG_MAS_FI_DIRECTORY', display_name:'MAS Financial Institutions Directory',
      category:'02', jurisdictions:['SG'], domain:'mas.gov.sg',
      verticals:['BROKER_DEALER','INVESTMENT_ADVISER','FOREX_CFD','CRYPTO','PRIVATE_FUND','PUBLIC_STOCK'] }),

  /* ---------------- 03 enforcement and sanctions ---------------- */
  S({ source_id:'IOSCO_ISCAN', display_name:'IOSCO I-SCAN', category:'03',
      jurisdictions:['INTL'], domain:'iosco.org' }),
  S({ source_id:'CA_AUTONOMOUS_SANCTIONS',
      display_name:'Canadian Consolidated Autonomous Sanctions List', category:'03',
      jurisdictions:['CA'], domain:'international.gc.ca', supports_person_search:true }),
  /* Was one row standing for five agencies with no host, so a hit on any of
     them had nowhere to land. Four now carry the host we checked on the
     agency's own site. The fifth, the Department of Justice, was already a
     row of its own and is not duplicated here. */
  S({ source_id:'CA_COMPETITION_BUREAU', display_name:'Competition Bureau Canada',
      category:'03', jurisdictions:['CA'], domain:'competition-bureau.canada.ca' }),
  S({ source_id:'US_FTC', display_name:'Federal Trade Commission', category:'03',
      jurisdictions:['US'], domain:'ftc.gov' }),
  S({ source_id:'US_CFPB', display_name:'Consumer Financial Protection Bureau',
      category:'03', jurisdictions:['US'], domain:'consumerfinance.gov' }),
  S({ source_id:'US_IC3', display_name:'Internet Crime Complaint Center', category:'03',
      jurisdictions:['US'], domain:'ic3.gov' }),
  S({ source_id:'SG_MAS_ALERT', display_name:'MAS Investor Alert List', category:'03',
      jurisdictions:['SG'], domain:'mas.gov.sg' }),
  S({ source_id:'BCSC_CAUTION', display_name:'BCSC Caution List', category:'03',
      jurisdictions:['CA-BC'], domain:'bcsc.bc.ca' }),
  S({ source_id:'ASC_CAUTION', display_name:'ASC Caution List', category:'03',
      jurisdictions:['CA-AB'], domain:'asc.ca' }),
  S({ source_id:'OSC_ALERTS', display_name:'OSC Alerts', category:'03',
      jurisdictions:['CA-ON'], domain:'osc.ca' }),
  S({ source_id:'CSA_ALERTS', display_name:'CSA Alerts', category:'03',
      jurisdictions:['CA'], domain:'securities-administrators.ca' }),
  S({ source_id:'FCA_WARNING', display_name:'FCA Warning List', category:'03',
      jurisdictions:['UK'], domain:'fca.org.uk' }),
  S({ source_id:'OFAC', display_name:'OFAC', category:'03',
      jurisdictions:['US'], domain:'sanctionssearch.ofac.treas.gov', supports_person_search:true }),
  S({ source_id:'UN_CONSOLIDATED', display_name:'UN Consolidated', category:'03',
      jurisdictions:['INTL'], domain:'un.org', supports_person_search:true }),
  S({ source_id:'DOJ_PRESS', display_name:'DOJ Press', category:'03', also:['04','05'],
      jurisdictions:['US'], domain:'justice.gov', supports_person_search:true,
      supports_historical:true }),
  S({ source_id:'IRS_CI', display_name:'IRS-CI', category:'03', also:['04'],
      jurisdictions:['US'], domain:'irs.gov', supports_person_search:true }),
  S({ source_id:'US_STATE_AG', display_name:'State AG', category:'03',
      jurisdictions:['US'], domain:'ag.ny.gov', supports_person_search:true }),

  /* NEW. Enforcement additions. */
  S({ source_id:'SEC_TRADING_SUSPENSIONS', display_name:'SEC Trading Suspensions', category:'03',
      jurisdictions:['US'], domain:'sec.gov', supports_historical:true,
      verticals:['PUBLIC_STOCK'] }),
  S({ source_id:'CFTC_RED_LIST', display_name:'CFTC RED List', category:'03', also:['02'],
      jurisdictions:['US'], domain:'cftc.gov',
      verticals:['FOREX_CFD','COMMODITIES','CRYPTO','BROKER_DEALER'] }),
  S({ source_id:'CFTC_ENFORCEMENT', display_name:'CFTC Enforcement', category:'03', also:['04','05'],
      jurisdictions:['US'], domain:'cftc.gov', transport:'parallel',
      supports_person_search:true, supports_historical:true,
      verticals:['FOREX_CFD','COMMODITIES','CRYPTO','PRIVATE_INVESTMENT','PRIVATE_FUND'] }),
  S({ source_id:'DFPI_CRYPTO_SCAM_TRACKER', display_name:'DFPI Crypto Scam Tracker', category:'03', also:['07'],
      /* Government published, but the underlying narratives are consumer reports.
         It is not an adjudicated finding and must never be rendered as one. */
      source_tier:'B', jurisdictions:['US-CA'], domain:'dfpi.ca.gov',
      evidence_kind:'government_published_consumer_report',
      supports_domain_search:true,
      verticals:['CRYPTO','FOREX_CFD','PRIVATE_INVESTMENT'] }),
  S({ source_id:'CIRO_DISCIPLINARY', display_name:'CIRO Discipline', category:'03', also:['04'],
      jurisdictions:['CA'], domain:'ciro.ca', supports_person_search:true,
      supports_historical:true,
      verticals:['BROKER_DEALER','INVESTMENT_ADVISER','PUBLIC_STOCK','PRIVATE_INVESTMENT'] }),
  S({ source_id:'ASIC_INVESTOR_ALERTS', display_name:'ASIC Investor Alerts', category:'03',
      jurisdictions:['AU'], domain:'asic.gov.au', supports_domain_search:true,
      supports_person_search:true }),
  S({ source_id:'HK_SFC_ALERT_LIST', display_name:'SFC Alert List', category:'03',
      jurisdictions:['HK'], domain:'sfc.hk', supports_domain_search:true }),

  /* ---------------- 04 people and control ---------------- */
  S({ source_id:'CA_ISC_FEDERAL',
      display_name:'Corporations Canada, Individuals with Significant Control', category:'04',
      jurisdictions:['CA'], domain:'ised-isde.canada.ca', supports_person_search:true }),
  S({ source_id:'ISC_OWNERSHIP', display_name:'ISC Ownership', category:'04',
      jurisdictions:['CA'], domain:'ic.gc.ca', supports_person_search:true }),
  S({ source_id:'UK_PSC', display_name:'UK PSC Register', category:'04',
      jurisdictions:['UK'], domain:'find-and-update.company-information.service.gov.uk',
      supports_person_search:true }),
  S({ source_id:'ASIC_BANNED', display_name:'ASIC Banned', category:'04', also:['03'],
      jurisdictions:['AU'], domain:'asic.gov.au', supports_person_search:true }),
  S({ source_id:'CSA_DISCIPLINED', display_name:'CSA Disciplined', category:'04', also:['03'],
      jurisdictions:['CA'], domain:'securities-administrators.ca', supports_person_search:true,
      supports_historical:true }),

  /* NEW. People additions. */
  S({ source_id:'CSA_DISCIPLINED_PERSONS', display_name:'CSA Disciplined Persons', category:'04', also:['03'],
      jurisdictions:['CA'], domain:'securities-administrators.ca', transport:'parallel',
      supports_person_search:true, supports_historical:true }),
  S({ source_id:'CSA_SEDI', display_name:'SEDI Insider Reports', category:'04', also:['01','10'],
      jurisdictions:['CA'], domain:'sedi.ca', transport:'parallel',
      supports_person_search:true, supports_historical:true,
      verticals:['PUBLIC_STOCK','PRIVATE_INVESTMENT'] }),

  /* ---------------- 05 legal and courts ---------------- */
  S({ source_id:'CANLII', display_name:'CanLII', category:'05',
      jurisdictions:['CA'], domain:'canlii.org', supports_person_search:true,
      supports_historical:true }),
  S({ source_id:'CA_SCC_FC', display_name:'Supreme Court of Canada and Federal Court',
      category:'05', jurisdictions:['CA'], domain:'decisions.fct-cf.gc.ca',
      supports_historical:true }),
  /* Had no host and so could never light, while the decisions it stands for
     are published by CanLII, which we already ask. The row now points at the
     host that actually serves it rather than declaring a gap that is not one. */
  S({ source_id:'CA_PROV_COURTS', display_name:'Provincial court decisions',
      category:'05', jurisdictions:['CA'], domain:'canlii.org',
      supports_historical:true }),
  /* Two different bodies were sitting in one hostless row. Both have a host we
     checked. The securities tribunals outside Ontario keep a row of their own,
     declared, because their decisions are not all served from one place. */
  S({ source_id:'CA_CAPITAL_MARKETS_TRIBUNAL', display_name:'Capital Markets Tribunal',
      category:'05', also:['03'], jurisdictions:['CA-ON'],
      domain:'capitalmarketstribunal.ca', supports_historical:true }),
  S({ source_id:'CA_COMPETITION_TRIBUNAL', display_name:'Competition Tribunal',
      category:'05', also:['03'], jurisdictions:['CA'], domain:'ct-tc.gc.ca',
      supports_historical:true }),
  S({ source_id:'CA_SEC_TRIBUNALS', unmapped:'Securities tribunal decisions outside Ontario. Each province serves them from its own commission site and no host list has been checked yet, so the row is declared rather than counted as reached.',
      display_name:'Securities tribunals outside Ontario', category:'05',
      also:['03'], jurisdictions:['CA'], transport:'parallel', domain:'',
      supports_historical:true }),
  S({ source_id:'OSB_BANKRUPTCY', display_name:'OSB Bankruptcy', category:'05',
      jurisdictions:['CA'], domain:'ised-isde.canada.ca' }),
  S({ source_id:'COURTLISTENER', display_name:'CourtListener', category:'05',
      source_tier:'B', jurisdictions:['US'], domain:'courtlistener.com',
      supports_person_search:true, supports_historical:true }),
  S({ source_id:'UK_INSOLVENCY', display_name:'UK Insolvency', category:'05',
      jurisdictions:['UK'], domain:'gov.uk' }),
  S({ source_id:'PACER', display_name:'PACER', category:'05',
      jurisdictions:['US'], domain:'pacer.gov', supports_person_search:true }),
  S({ source_id:'JUSTIA_DOCKETS', display_name:'Justia Dockets', category:'05',
      source_tier:'B', jurisdictions:['US'], domain:'dockets.justia.com',
      supports_person_search:true }),
  S({ source_id:'BANKRUPTCY_CLAIMS', display_name:'Bankruptcy Claims', category:'05',
      source_tier:'B', jurisdictions:['US'], domain:'kccllc.net' }),

  /* NEW. Canadian issuer filings. */
  S({ source_id:'CSA_SEDAR_PLUS', display_name:'SEDAR+', category:'05', also:['01','10'],
      jurisdictions:['CA'], domain:'sedarplus.ca', transport:'parallel',
      supports_historical:true,
      verticals:['PUBLIC_STOCK','PRIVATE_INVESTMENT','PRIVATE_FUND'] }),

  /* ---------------- 06 web and infrastructure ---------------- */
  S({ source_id:'ICANN_RDAP', display_name:'ICANN RDAP', category:'06', also:['10'],
      transport:'connector', supports_domain_search:true, entity_types:['WEBSITE'],
      cost_class:'free' }),
  S({ source_id:'CERT_LOG', display_name:'Certificate Log', category:'06', also:['10'],
      source_tier:'B', domain:'crt.sh', supports_domain_search:true, entity_types:['WEBSITE'] }),
  S({ source_id:'GOOGLE_WEB_RISK', display_name:'Google Web Risk', category:'06',
      source_tier:'B', domain:'transparencyreport.google.com', supports_domain_search:true,
      entity_types:['WEBSITE'] }),
  S({ source_id:'VIRUSTOTAL', display_name:'VirusTotal', category:'06',
      source_tier:'B', domain:'virustotal.com', supports_domain_search:true,
      entity_types:['WEBSITE'] }),
  S({ source_id:'URLSCAN', display_name:'urlscan.io', category:'06',
      source_tier:'B', domain:'urlscan.io', supports_domain_search:true,
      entity_types:['WEBSITE'] }),
  S({ source_id:'MAIL_CONFIG', display_name:'Mail Config', category:'06',
      transport:'connector', source_tier:'B', supports_domain_search:true,
      entity_types:['WEBSITE'], cost_class:'free' }),

  /* ---------------- 07 what other people are saying ---------------- */
  S({ source_id:'TRUSTPILOT', display_name:'Trustpilot', category:'07', source_tier:'C', domain:'trustpilot.com' }),
  S({ source_id:'SITEJABBER', display_name:'Sitejabber', category:'07', source_tier:'C', domain:'sitejabber.com' }),
  S({ source_id:'BBB_SCAM_TRACKER', display_name:'BBB Scam Tracker', category:'07', source_tier:'C', domain:'bbb.org' }),
  S({ source_id:'FOREX_PEACE_ARMY', display_name:'Forex Peace Army', category:'07', source_tier:'C',
      domain:'forexpeacearmy.com', verticals:['FOREX_CFD','CRYPTO','COMMODITIES','BROKER_DEALER'] }),
  S({ source_id:'REDDIT', display_name:'Reddit', category:'07', source_tier:'D', domain:'reddit.com' }),
  S({ source_id:'GLASSDOOR', display_name:'Glassdoor', category:'07', source_tier:'C', domain:'glassdoor.com' }),

  /* ---------------- 08 payment and settlement ---------------- */
  S({ source_id:'BENEFICIARY_MATCH', display_name:'Beneficiary Match', category:'08',
      source_tier:'4orm', transport:'connector', entity_types:['DOCUMENT'], cost_class:'free' }),
  S({ source_id:'IBAN_SWIFT', display_name:'IBAN and SWIFT', category:'08',
      source_tier:'B', transport:'connector', entity_types:['DOCUMENT'], cost_class:'free' }),
  S({ source_id:'CHAINABUSE', display_name:'Chainabuse', category:'08', also:['07'],
      source_tier:'C', domain:'chainabuse.com', supports_wallet_search:true,
      verticals:['CRYPTO'] }),
  S({ source_id:'CHAIN_ANALYTICS', display_name:'Chain Analytics', category:'08',
      source_tier:'B', transport:'connector', supports_wallet_search:true,
      verticals:['CRYPTO'], cost_class:'free' }),

  /* NEW. Blockchain explorers. First party chain data, read directly.
     A chain record proves what moved. It never proves who owns the address. */
  S({ source_id:'ETHERSCAN', display_name:'Etherscan', category:'08', also:['09','10'],
      source_tier:'B', domain:'etherscan.io', supports_wallet_search:true,
      supports_historical:true, entity_types:['WALLET'], verticals:['CRYPTO'] }),
  S({ source_id:'SOLSCAN', display_name:'Solscan', category:'08', also:['09','10'],
      source_tier:'B', domain:'solscan.io', supports_wallet_search:true,
      supports_historical:true, entity_types:['WALLET'], verticals:['CRYPTO'] }),
  S({ source_id:'TRONSCAN', display_name:'Tronscan', category:'08', also:['09','10'],
      source_tier:'B', domain:'tronscan.org', supports_wallet_search:true,
      supports_historical:true, entity_types:['WALLET'], verticals:['CRYPTO'] }),
  S({ source_id:'BTC_EXPLORER', display_name:'Bitcoin Explorer', category:'08', also:['09','10'],
      source_tier:'B', domain:'blockchain.com', supports_wallet_search:true,
      supports_historical:true, entity_types:['WALLET'], verticals:['CRYPTO'] }),

  /* ---------------- 09 4orm proprietary, the operator graph ---------------- */
  S({ source_id:'INFRA_CLUSTER', display_name:'Infrastructure Cluster', category:'09',
      source_tier:'4orm', transport:'connector', supports_domain_search:true, cost_class:'free' }),
  S({ source_id:'IDENTIFIER_REUSE', display_name:'Identifier Reuse', category:'09',
      source_tier:'4orm', transport:'connector', supports_domain_search:true, cost_class:'free' }),
  S({ source_id:'DOC_FINGERPRINT', display_name:'Document Fingerprint', category:'09',
      source_tier:'4orm', transport:'connector', entity_types:['DOCUMENT'], cost_class:'free' }),

  /* NEW. The graph sources. */
  S({ source_id:'PUBLICWWW', display_name:'Analytics and Pixel Reuse', category:'09',
      source_tier:'B', domain:'publicwww.com', transport:'exa_pinned',
      supports_domain_search:true, entity_types:['WEBSITE'],
      requires_key:false, key_name:'PUBLICWWW_API_KEY', supports_historical:false }),
  S({ source_id:'BUILTWITH', display_name:'Site Technology', category:'09',
      source_tier:'B', domain:'builtwith.com', supports_domain_search:true,
      entity_types:['WEBSITE'], key_name:'BUILTWITH_API_KEY' }),
  S({ source_id:'SECURITYTRAILS', display_name:'DNS and IP History', category:'09', also:['06','10'],
      source_tier:'B', domain:'securitytrails.com', supports_domain_search:true,
      supports_historical:true, entity_types:['WEBSITE'], key_name:'SECURITYTRAILS_API_KEY' }),
  S({ source_id:'CENSYS', display_name:'Host and Certificate Graph', category:'09', also:['06'],
      source_tier:'B', domain:'censys.io', supports_domain_search:true,
      supports_historical:true, entity_types:['WEBSITE'], key_name:'CENSYS_API_KEY' }),
  S({ source_id:'WALLET_REUSE', display_name:'Wallet Reuse', category:'09',
      source_tier:'4orm', transport:'connector', supports_wallet_search:true,
      verticals:['CRYPTO'], cost_class:'free' }),
  S({ source_id:'BENEFICIARY_REUSE', display_name:'Beneficiary Reuse', category:'09',
      source_tier:'4orm', transport:'connector', entity_types:['DOCUMENT'], cost_class:'free' }),
  S({ source_id:'PEOPLE_CLUSTER', display_name:'People Cluster', category:'09',
      source_tier:'4orm', transport:'connector', supports_person_search:true, cost_class:'free' }),
  S({ source_id:'OPERATOR_GRAPH', display_name:'Operator Graph', category:'09',
      source_tier:'4orm', transport:'connector', cost_class:'free' }),

  /* ---------------- 10 claim dates against the record ---------------- */
  S({ source_id:'RDAP_DATE', display_name:'ICANN RDAP Date', category:'10',
      transport:'connector', supports_domain_search:true, entity_types:['WEBSITE'], cost_class:'free' }),
  S({ source_id:'WAYBACK', display_name:'Wayback Machine', category:'10',
      source_tier:'B', domain:'web.archive.org', supports_domain_search:true,
      supports_historical:true }),
  S({ source_id:'FIRST_CERT', display_name:'First Certificate', category:'10',
      source_tier:'B', domain:'crt.sh', supports_domain_search:true, supports_historical:true }),
  S({ source_id:'TRADEMARK', display_name:'Trademark Filing', category:'10',
      domain:'tsdr.uspto.gov', supports_historical:true }),
  S({ source_id:'DOMAIN_HISTORY', display_name:'Domain History', category:'10',
      source_tier:'B', domain:'securitytrails.com', supports_domain_search:true,
      supports_historical:true }),
  S({ source_id:'INCORP_DATE', display_name:'Incorporation Date', category:'10',
      transport:'connector', supports_historical:true, cost_class:'free' }),
  S({ source_id:'PUBLIC_PROFILE', display_name:'Public Profile', category:'10',
      source_tier:'D', domain:'linkedin.com', supports_person_search:true }),

  /* NEW. Every one of these is a date somebody else recorded, which is the only
     kind of date a dated claim can honestly be checked against. */
  S({ source_id:'FORM_D_FIRST', display_name:'Form D First Filing', category:'10',
      jurisdictions:['US'], domain:'sec.gov', transport:'parallel', supports_historical:true,
      verticals:['PRIVATE_INVESTMENT','VC_STARTUP','PRIVATE_FUND','CRYPTO'] }),
  S({ source_id:'FORM_D_FIRST_SALE', display_name:'Form D First Sale', category:'10',
      jurisdictions:['US'], domain:'sec.gov', transport:'parallel', supports_historical:true,
      verticals:['PRIVATE_INVESTMENT','VC_STARTUP','PRIVATE_FUND','CRYPTO'] }),
  S({ source_id:'EDGAR_FIRST', display_name:'EDGAR First Filing', category:'10',
      jurisdictions:['US'], domain:'sec.gov', supports_historical:true,
      verticals:['PUBLIC_STOCK','PRIVATE_INVESTMENT','VC_STARTUP','PRIVATE_FUND','INVESTMENT_ADVISER'] }),
  S({ source_id:'SEDAR_FIRST', display_name:'SEDAR+ First Filing', category:'10',
      jurisdictions:['CA'], domain:'sedarplus.ca', supports_historical:true,
      verticals:['PUBLIC_STOCK','PRIVATE_INVESTMENT','PRIVATE_FUND'] }),
  S({ source_id:'SEDI_FIRST', display_name:'SEDI First Insider Record', category:'10',
      jurisdictions:['CA'], domain:'sedi.ca', supports_historical:true,
      verticals:['PUBLIC_STOCK'] }),
  S({ source_id:'IAPD_FIRST', display_name:'IAPD First Registration', category:'10',
      jurisdictions:['US'], domain:'adviserinfo.sec.gov', supports_historical:true,
      verticals:['INVESTMENT_ADVISER','PRIVATE_INVESTMENT','PRIVATE_FUND'] }),
  S({ source_id:'APP_STORE_FIRST', display_name:'App Store First Release', category:'10',
      source_tier:'B', domain:'apps.apple.com', supports_historical:true }),
  S({ source_id:'PLAY_STORE_FIRST', display_name:'Google Play First Release', category:'10',
      source_tier:'B', domain:'play.google.com', supports_historical:true }),
  S({ source_id:'GITHUB_REPO_CREATED', display_name:'GitHub Repository Created', category:'10', also:['09'],
      source_tier:'B', domain:'github.com', supports_historical:true,
      verticals:['VC_STARTUP','CRYPTO'] }),
  S({ source_id:'GITHUB_FIRST_COMMIT', display_name:'GitHub First Commit', category:'10', also:['09'],
      source_tier:'B', domain:'github.com', supports_historical:true,
      verticals:['VC_STARTUP','CRYPTO'] }),
  S({ source_id:'FIRST_PRESS_RELEASE', display_name:'First Press Release', category:'10',
      source_tier:'D', domain:'prnewswire.com', supports_historical:true }),
  S({ source_id:'FIRST_YOUTUBE', display_name:'First YouTube Video', category:'10',
      source_tier:'D', domain:'youtube.com', supports_historical:true }),
  S({ source_id:'FIRST_SOCIAL_POST', display_name:'First Social Post', category:'10',
      source_tier:'D', domain:'x.com', supports_historical:true })
];

/* ------------------------------------------------------------------ *
 * DERIVED VIEWS
 * Everything below is computed. Nothing here is a number typed by hand.
 * ------------------------------------------------------------------ */

export const BY_ID = Object.fromEntries(CATALOGUE.map(s => [s.source_id, s]));
export const BY_NAME = Object.fromEntries(CATALOGUE.map(s => [s.display_name, s]));

/* ===================== WHAT WE ASK, AND WHAT WE WORK OUT. TWO DIFFERENT THINGS.
   The catalogue held both in one list and every coverage figure this product
   ever printed divided by the total. Fourteen of those rows are connectors: the
   operator graph, wallet reuse, the infrastructure cluster, the document
   fingerprint and the rest. They are not registers and were never going to be
   asked, so a run that reached every register on earth would still have read
   about eighty-seven per cent on the board, and the missing thirteen looked
   like a coverage hole rather than a category error.
   A register is a place we send a question. A connector is something we run
   over what the run already holds. They get different denominators because
   they answer different questions: how much of the record did we reach, and
   did our own checks run. */
export const ASKABLE  = CATALOGUE.filter(s => s.enabled && s.transport !== 'connector');
export const COMPUTED = CATALOGUE.filter(s => s.enabled && s.transport === 'connector');

export const TOTAL_SOURCES = CATALOGUE.filter(s => s.enabled).length;
/* The denominator for coverage. Never TOTAL_SOURCES: a figure divided by things
   that cannot be asked is a figure that cannot reach a hundred. */
export const TOTAL_ASKABLE = ASKABLE.length;

/* PUBLISHED, NOT ASKED, AND WAITING ON A SIGNATURE.
   A register reaches a reader only through a signed SR-001 row and legal
   review, so a new one cannot be turned on by editing code. These rows sit
   here so the jurisdiction they cover has a name the page can say out loud,
   and so that enabling one is a signature rather than a commit. They are in no
   count, on no board, and nothing asks them. */
export const PENDING = CATALOGUE.filter(s => !s.enabled && s.pending);

/* Every check a source can contribute to: its home category plus its also list. */
export function categoriesFor(s) {
  return [s.category, ...(s.also || [])];
}

/* The board, grouped the way the console draws it. */
export const CATEGORY_NAMES = {
  '01':'01 Identity', '02':'02 Licensing', '03':'03 Enforcement', '04':'04 People',
  '05':'05 Legal', '06':'06 Web', '07':'07 Reviews', '08':'08 Payment',
  '09':'09 4orm', '10':'10 Claim dates'
};

export function board() {
  const groups = {};
  CATALOGUE.filter(s => s.enabled).forEach(s => {
    (groups[s.category] = groups[s.category] || []).push(s.display_name);
  });
  return Object.keys(groups).sort().map(c => ({ c: CATEGORY_NAMES[c], items: groups[c] }));
}

/* ------------------------------------------------------------------ *
 * APPLICABILITY
 *
 * A source applies to this run when its vertical list overlaps the party's
 * classification AND its entity type could describe the subject. Jurisdiction
 * narrows it further only where we have positive evidence of where the party
 * operates, because a party can solicit anywhere and an absent jurisdiction
 * signal must never quietly shrink the check.
 *
 * Returns { applicable, notApplicable } so both halves can be published. A
 * source that does not apply is named in the report as could-never-have-applied
 * rather than counted as a gap.
 * ------------------------------------------------------------------ */
export function applicable(ctx = {}) {
  const verts = (ctx.verticals && ctx.verticals.length) ? ctx.verticals : ['OTHER'];
  const vset = new Set(verts);
  const jur = new Set(ctx.jurisdictions || []);
  const kinds = new Set(ctx.entity_kinds || ['COMPANY', 'WEBSITE']);
  const hasWallet = !!ctx.wallet;
  const hasDocument = !!ctx.document;

  const yes = [], no = [];
  CATALOGUE.filter(s => s.enabled).forEach(s => {
    const reason = whyNot(s, { vset, jur, kinds, hasWallet, hasDocument });
    (reason ? no : yes).push(reason ? { source: s, reason } : s);
  });
  return { applicable: yes, notApplicable: no };
}

function whyNot(s, c) {
  /* A wallet-only source with no wallet in hand could not have held a record. */
  if (s.entity_types.length === 1 && s.entity_types[0] === 'WALLET' && !c.hasWallet)
    return 'no wallet address was supplied or found';
  if (s.entity_types.length === 1 && s.entity_types[0] === 'DOCUMENT' && !c.hasDocument)
    return 'no document or payment instruction was supplied';

  /* Vertical routing. ALL means it applies whatever the party is. */
  if (!s.verticals.includes(ALL)) {
    const hit = s.verticals.some(v => c.vset.has(v));
    if (!hit) return 'covers ' + s.verticals.join(', ').toLowerCase() +
      ', and this party was not classified as any of those';
  }

  /* Jurisdiction only excludes when we positively know where the party is and
     the source is a domestic register for somewhere else. INTL and empty never
     exclude. */
  if (s.jurisdictions.length && c.jur.size && !s.jurisdictions.includes('INTL')) {
    const hit = s.jurisdictions.some(j =>
      c.jur.has(j) || [...c.jur].some(k => k.startsWith(j + '-') || j.startsWith(k + '-')));
    if (!hit) return 'a ' + s.jurisdictions.join('/') + ' register, and no ' +
      s.jurisdictions[0] + ' activity was established for this party';
  }
  return null;
}

/* The three numbers the console prints. Computed, never typed. */
export function counts(plan = {}) {
  const { applicable: app } = applicable(plan.ctx || {});
  return {
    available: TOTAL_SOURCES,
    applicable: app.length,
    attempted: plan.attempted || 0,
    reached: plan.reached || 0
  };
}

export default { CATALOGUE, BY_ID, BY_NAME, TOTAL_SOURCES, TOTAL_ASKABLE, ASKABLE, COMPUTED, board, applicable, counts, VERTICALS };
