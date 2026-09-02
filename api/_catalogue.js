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
  S({ source_id:'OFFSHORE_REGISTRIES',
      display_name:'Offshore registries: Cayman, BVI, Bermuda, Bahamas, Jersey, Guernsey, Isle of Man, Malta, Cyprus, Mauritius, Seychelles, Belize, Panama, UAE free zones',
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
  S({ source_id:'CA_PROV_SECTOR_REGULATORS',
      display_name:'BCFSA, RECA, AMF, FCAA, Manitoba and Atlantic regulators',
      category:'02', jurisdictions:['CA'], transport:'parallel', domain:'' }),
  S({ source_id:'US_NMLS', display_name:'NMLS Consumer Access', category:'02', also:['04'],
      jurisdictions:['US'], domain:'nmlsconsumeraccess.org',
      supports_person_search:true }),
  S({ source_id:'SG_MAS_FI_DIRECTORY', display_name:'MAS Financial Institutions Directory',
      category:'02', jurisdictions:['SG'], domain:'mas.gov.sg',
      verticals:['BROKER_DEALER','INVESTMENT_ADVISER','FOREX_CFD','CRYPTO','PRIVATE_FUND','PUBLIC_STOCK'] }),

  /* ---------------- 03 enforcement and sanctions ---------------- */
  S({ source_id:'IOSCO_ISCAN', display_name:'IOSCO I-SCAN', category:'03',
      jurisdictions:['INTL'], domain:'iosco.org' }),
  S({ source_id:'CA_AUTONOMOUS_SANCTIONS',
      display_name:'Canadian Consolidated Autonomous Sanctions List', category:'03',
      jurisdictions:['CA'], domain:'international.gc.ca', supports_person_search:true }),
  S({ source_id:'CONSUMER_AGENCY_ALERTS',
      display_name:'Competition Bureau, FTC, CFPB, DOJ, IC3 public alerts', category:'03',
      jurisdictions:['INTL'], transport:'parallel', domain:'' }),
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
  S({ source_id:'CA_PROV_COURTS', display_name:'Provincial courts and tribunals',
      category:'05', jurisdictions:['CA'], transport:'parallel', domain:'',
      supports_historical:true }),
  S({ source_id:'CA_SEC_TRIBUNALS',
      display_name:'Securities tribunals and the Competition Tribunal', category:'05',
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

export const TOTAL_SOURCES = CATALOGUE.filter(s => s.enabled).length;

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

export default { CATALOGUE, BY_ID, BY_NAME, TOTAL_SOURCES, board, applicable, counts, VERTICALS };
