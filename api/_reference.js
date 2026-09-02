/**
 * 4orm IQ - REGISTER REFERENCE
 *
 * One entry per register on the board. Four things, and they are the four
 * things a reader needs when a light goes on and they do not know what it is:
 *
 *   info  [jurisdiction label, tier, what this register is, where to open it]
 *   hit   what it means if this register has an entry for the party
 *   miss  what it means if it does not, which is almost never "they are fine"
 *   look  the one thing to read first when you open it yourself
 *
 * The console renders these. tools/sync-catalogue.mjs writes them into
 * index.html from here, so the board, the catalogue and the reference cannot
 * drift apart. Every register on the board must have an entry: the build
 * check fails if one is missing.
 */

export const REFERENCE = {

/* ------------------------------------------------------------------ *
 * THE REGISTERS SR-001 CLEARED AND THE CATALOGUE HAD NEVER CARRIED.
 * Sector licensing, the courts, and the registries outside the four
 * jurisdictions the first build covered.
 * ------------------------------------------------------------------ */

"Registraire des entreprises du Quebec": {
  info: ["CA-QC","A","Quebec's enterprise register. Confirms a Quebec company exists, its status, its address and the people declared to it.","https://www.registreentreprises.gouv.qc.ca/"],
  hit: "A company registered in Quebec, with its status and its declared officers.",
  miss: "Nothing in Quebec. It may be federal or registered in another province.",
  look: "Read the status and the date of the last annual declaration. A company that has stopped filing is a company that has stopped being maintained."
},

"ACRA": {
  info: ["SG","A","Singapore's corporate register. Confirms a Singapore entity exists and its standing.","https://www.acra.gov.sg/"],
  hit: "A Singapore entity by that name exists, with a UEN and a status.",
  miss: "Nothing in Singapore. A firm claiming a Singapore base with no ACRA record should be asked about it.",
  look: "The entity status. Live is what you want. Struck off or in liquidation means what it says."
},

"Hong Kong Companies Registry": {
  info: ["HK","A","Hong Kong's companies register. Confirms incorporation and standing.","https://www.cr.gov.hk/"],
  hit: "A Hong Kong company by that name exists, with a registration number.",
  miss: "Nothing in Hong Kong. A firm claiming a Hong Kong base with no record should be asked about it.",
  look: "Whether the company is live, and when it was incorporated. A recent incorporation behind a long claimed history is the contradiction to chase."
},

"New Zealand Companies Office": {
  info: ["NZ","A","New Zealand's companies register. Confirms incorporation, standing and directors.","https://companies-register.companiesoffice.govt.nz/"],
  hit: "A New Zealand company by that name exists, with its directors on the record.",
  miss: "Nothing in New Zealand. The company may be registered elsewhere.",
  look: "The registered office address and the directors. A New Zealand shell with an overseas director and a virtual address is a known pattern."
},

"Offshore registries: Cayman, BVI, Bermuda, Bahamas, Jersey, Guernsey, Isle of Man, Malta, Cyprus, Mauritius, Seychelles, Belize, Panama, UAE free zones": {
  info: ["INTL","B","The company registers of the jurisdictions most often used to hold a fund or an operating entity offshore. Coverage differs by island: some publish a searchable register, some publish almost nothing.","https://www.opencorporates.com/"],
  hit: "An entity by that name is recorded in one of those jurisdictions.",
  miss: "Nothing found. Several of these registers are closed to the public, so an absence here proves very little.",
  look: "Which jurisdiction it is in, and whether that jurisdiction actually publishes the register. An offshore entity is legal and common. What matters is whether the one you were told about is the one that exists."
},

"RECO real estate register": {
  info: ["CA-ON","A","The Real Estate Council of Ontario's register. Says whether a brokerage is registered to trade in real estate in Ontario.","https://www.reco.on.ca/"],
  hit: "The brokerage is registered with RECO, or it appears in RECO's discipline record.",
  miss: "No RECO registration. In Ontario, trading in real estate without registration is an offence, so an absence is worth asking about directly.",
  look: "Look for the brokerage, not the person. Check the registration status and whether there is a discipline decision attached."
},

"FSRA Ontario, mortgage and insurance licences": {
  info: ["CA-ON","A","The Financial Services Regulatory Authority of Ontario. Licenses mortgage brokerages, insurance agencies, credit unions and loan companies in Ontario.","https://www.fsrao.ca/"],
  hit: "The firm holds an Ontario licence for what it is doing, or it appears in FSRA's enforcement record.",
  miss: "No Ontario licence found for that activity. A firm arranging mortgages or selling insurance in Ontario needs one.",
  look: "Match the licence to the activity. A licence to sell insurance is not a licence to arrange a mortgage, and a firm holding one while doing the other is the thing to notice."
},

"BCFSA, RECA, AMF, FCAA, Manitoba and Atlantic regulators": {
  info: ["CA","A","The provincial bodies that license real estate, mortgage and insurance outside Ontario: the BC Financial Services Authority, the Real Estate Council of Alberta, the Autorite des marches financiers, the Financial and Consumer Affairs Authority of Saskatchewan, and their Manitoba and Atlantic counterparts.","https://www.bcfsa.ca/"],
  hit: "The firm holds a licence in that province for what it is doing, or it appears in that regulator's enforcement record.",
  miss: "No licence found in that province. A licence in one province is not a licence in another.",
  look: "Check the province the money is going to, not only the province you are in. These regulators do not share one register, and each one only answers for its own."
},

"NMLS Consumer Access": {
  info: ["US","A","The United States national register of mortgage and consumer lending licences, for companies and individuals.","https://www.nmlsconsumeraccess.org/"],
  hit: "The firm holds a state lending licence, with the states it covers listed.",
  miss: "No NMLS record. A firm arranging a mortgage or a consumer loan in the United States needs one in every state it operates in.",
  look: "The states listed on the licence. A licence in one state is not a licence to lend in yours."
},

"MAS Financial Institutions Directory": {
  info: ["SG","A","The Monetary Authority of Singapore's directory of the institutions it regulates.","https://eservices.mas.gov.sg/fid"],
  hit: "The firm is regulated in Singapore, with the activities it is licensed for.",
  miss: "Not regulated by MAS. A firm claiming a Singapore licence with no directory entry is claiming something the regulator does not confirm.",
  look: "The licence type against what they are actually offering you."
},

"Canadian Consolidated Autonomous Sanctions List": {
  info: ["CA","A","Canada's own sanctions list, held by Global Affairs Canada. Names the people and entities Canadians are prohibited from dealing with.","https://www.international.gc.ca/world-monde/international_relations-relations_internationales/sanctions/consolidated-consolide.aspx"],
  hit: "A name on this list is a legal prohibition, not a warning. Do not send anything and speak to your bank.",
  miss: "Not on Canada's sanctions list. That is the floor, not a clearance.",
  look: "Match the full legal name and any listed alias. Sanctions lists carry aliases precisely because names get changed."
},

"Competition Bureau, FTC, CFPB, DOJ, IC3 public alerts": {
  info: ["INTL","A","The public warnings issued by the consumer and competition authorities of Canada and the United States, and by the FBI's internet crime centre.","https://competition-bureau.canada.ca/"],
  hit: "A consumer authority has published something naming this party or this scheme.",
  miss: "No consumer alert found. These bodies publish selectively, so silence here is very weak evidence.",
  look: "Whether the alert names this party or names a pattern the approach you received matches. Both are worth knowing, and they are not the same thing."
},

"MAS Investor Alert List": {
  info: ["SG","A","The Monetary Authority of Singapore's list of unregulated persons who may have been wrongly perceived as licensed.","https://www.mas.gov.sg/investor-alert-list"],
  hit: "MAS has published this name as one that may be mistaken for a regulated firm.",
  miss: "Not on the MAS list. The list only covers what has been reported to MAS.",
  look: "The exact entity name and the website beside it. These entries usually name the site as well as the brand."
},

"Corporations Canada, Individuals with Significant Control": {
  info: ["CA","A","The federal register of the people who actually control a federally incorporated company, as opposed to the directors named on the front of it.","https://ised-isde.canada.ca/"],
  hit: "The people with real control over the company are on the record.",
  miss: "No control record. Federal companies are required to keep this, so an absence for a federal corporation is a filing failure worth noting.",
  look: "Compare the people with control against the people who have been talking to you. They are not always the same, and the difference is the point of this register."
},

"Supreme Court of Canada and Federal Court": {
  info: ["CA","A","The decisions of Canada's highest court and of the Federal Court.","https://decisions.fct-cf.gc.ca/"],
  hit: "The party has been before one of these courts. Read what the case was about before drawing anything from it.",
  miss: "Nothing at this level. Most disputes never reach these courts, so this proves very little on its own.",
  look: "What the party was doing in the case. Being sued, suing somebody, and being prosecuted are three different facts."
},

"Provincial courts and tribunals": {
  info: ["CA","A","The published decisions of the provincial superior and small claims courts and of the provincial tribunals.","https://www.canlii.org/"],
  hit: "A decision names the party. Most commercial disputes end up here rather than in a federal court.",
  miss: "No published decision found. Many proceedings are settled or never published, so an absence is not a clean record.",
  look: "The date and the outcome. An old settled dispute and a current unsatisfied judgment are not the same thing at all."
},

"Securities tribunals and the Competition Tribunal": {
  info: ["CA","A","The tribunals that decide securities enforcement in each province, and the federal Competition Tribunal.","https://www.canlii.org/"],
  hit: "A tribunal has made a finding about this party. This is the record behind most regulator caution list entries.",
  miss: "No tribunal decision found. A regulator can warn about a party long before any tribunal has heard it.",
  look: "Whether the decision is a finding, an order, or a settlement, and what the party agreed to. A settlement without an admission is still a fact, and it is not a finding of wrongdoing."
},

"Corporations Canada": {
  info: ["CA","A","The federal corporate register. Confirms a federally incorporated company exists, its status, and its directors.","https://ised-isde.canada.ca/cc/lgcy/fdrlCrpSrch.html"],
  hit: "A federal company by that name exists, with a number, a status and directors on the record.",
  miss: "Nothing federal was found. The company may still be provincially incorporated, which is normal for a small business.",
  look: "Look at the status line first. Active is what you want. Dissolved, struck off or in default means the company you are being asked to pay does not legally exist right now."
},

"Ontario Registry": {
  info: ["CA-ON","A","Ontario's business registry. Confirms provincial incorporation and standing.","https://www.ontario.ca/page/ontario-business-registry"],
  hit: "A company registered in Ontario, with its status.",
  miss: "Nothing in Ontario. It may be federal or in another province.",
  look: "Check the legal name against the name on the invoice or contract. A trading name is not a legal name."
},

"BC Registry": {
  info: ["CA-BC","A","British Columbia corporate registry.","https://www.bcregistry.gov.bc.ca/"],
  hit: "A company registered in British Columbia.",
  miss: "Nothing in BC.",
  look: "Status and the registered office address."
},

"Alberta Registry": {
  info: ["CA-AB","A","Alberta corporate registry. Access is through authorised service providers.",""],
  hit: "A company registered in Alberta.",
  miss: "Nothing in Alberta, or the register was not reachable.",
  look: "Status, and whether the directors match who you are dealing with."
},

"SEC EDGAR": {
  info: ["US","A","Every filing made to the Securities and Exchange Commission. Absence of a filing is meaningful for a party claiming to sell investments in the United States.","https://www.sec.gov/edgar/search/"],
  hit: "A filing exists with the United States securities regulator.",
  miss: "No filing. For a party selling investments to Americans, that absence is the point rather than a detail.",
  look: "Look for a Form D, which is the filing an exempt private offering makes. No Form D and no registration, from a party taking investor money, is a question they need to answer."
},

"Companies House": {
  info: ["UK","A","The United Kingdom register. Company number, officers, filing history and persons with significant control.","https://find-and-update.company-information.service.gov.uk/"],
  hit: "A United Kingdom company, with its number, officers and filing history.",
  miss: "Nothing in the UK register.",
  look: "Filing history. A company that has stopped filing accounts is a company in trouble."
},

"Florida Sunbiz": {
  info: ["US-FL","A","Florida's corporate register. Incorporation date, registered agent, officers and annual reports.","https://search.sunbiz.org/"],
  hit: "A Florida corporation, with its incorporation date, registered agent and officers.",
  miss: "Nothing in Florida.",
  look: "The incorporation date. Nothing the company did can predate it, whatever the website says."
},

"OpenCorporates": {
  info: ["GLOBAL","B","An aggregated view across many state and national registers. Useful for finding a record; the register itself is the authority.","https://opencorporates.com/"],
  hit: "A record aggregated from a state or national register.",
  miss: "Nothing found in the aggregated set.",
  look: "Use it to find which register holds the record, then open that register. The aggregator is a finding aid, not the authority."
},

"CSA Registration": {
  info: ["CA","A","The Canadian Securities Administrators National Registration Search. Answers whether a party may lawfully sell investments anywhere in Canada.","https://www.securities-administrators.ca/nrs/"],
  hit: "The party is registered to sell investments somewhere in Canada, and the categories say what it may sell.",
  miss: "No matching registration was found. That is not proof they are unregistered, and it is the single most important question to put to them.",
  look: "Match the exact legal name and the category. A firm registered as an exempt market dealer may not sell you what a portfolio manager can."
},

"CIRO AdvisorReport": {
  info: ["CA","A","Registration and disciplinary history for an individual adviser or dealer.","https://www.ciro.ca/investors/advisorreport"],
  hit: "A registration and disciplinary history for a named individual adviser.",
  miss: "No record for that person.",
  look: "Read the disciplinary section before the credentials section."
},

"FINTRAC MSB": {
  info: ["CA","A","Canada's money services business register. Required for anyone exchanging or transmitting value as a business.","https://fintrac-canafe.canada.ca/msb-esm/msb-search-recherche-eng"],
  hit: "Registered in Canada to exchange or transmit money as a business.",
  miss: "No registration found.",
  look: "Anyone moving your money for you should be here. If they are not, ask why not."
},

"Bank of Canada PSP": {
  info: ["CA","A","The payment service provider register under the Retail Payment Activities Act.","https://www.bankofcanada.ca/core-functions/retail-payments-supervision/"],
  hit: "Registered as a payment service provider under the Retail Payment Activities Act.",
  miss: "No registration found.",
  look: "This register is new. Absence from it is weaker evidence than absence from an established one."
},

"FCA Register": {
  info: ["UK","A","The Financial Conduct Authority register of authorised firms and individuals.","https://register.fca.org.uk/"],
  hit: "Authorised by the United Kingdom regulator, with permissions listed.",
  miss: "No authorisation found.",
  look: "Check the permissions, not only the presence. A firm authorised for one activity is not authorised for all of them."
},

"BrokerCheck": {
  info: ["US","A","FINRA's record of brokers and firms, including disclosures and disciplinary events.","https://brokercheck.finra.org/"],
  hit: "A United States broker or firm, with disclosures and disciplinary events.",
  miss: "No record.",
  look: "The disclosures section. Customer complaints, terminations and regulatory events all sit there."
},

"NFA BASIC": {
  info: ["US","A","National Futures Association background affiliation status. Covers futures and forex.","https://www.nfa.futures.org/basicnet/"],
  hit: "Registered for futures or forex in the United States.",
  miss: "No registration found.",
  look: "Anyone offering leveraged forex to Americans should be here."
},

"FinCEN MSB": {
  info: ["US","A","The United States money services business register. The decisive check for anyone pooling funds and paying distributions.","https://www.fincen.gov/msb-registrant-search"],
  hit: "Registered as a money services business in the United States.",
  miss: "No registration found. For a party pooling funds and paying distributions, this absence carries weight.",
  look: "Registration here is a filing, not an approval. It means they told the government what they do. It is a floor, not a seal."
},

"SEC IAPD, Form ADV": {
  info: ["US","A","The Securities and Exchange Commission's public file on investment advisers. Every registered adviser files a Form ADV describing who it is, who controls it, what it manages and every disciplinary event it has to disclose.","https://adviserinfo.sec.gov/"],
  hit: "A Form ADV exists. You get the exact registered legal name, the CRD number, the SEC file number, the control persons, the funds it runs, and every disciplinary disclosure the firm was required to make.",
  miss: "No adviser registration was located under the names searched. For a firm that advises on or manages other people's money in the United States, that is a serious question. For a firm that does neither, it means nothing.",
  look: "Match the legal name and the CRD number against what the party told you. A registration number that belongs to a different legal entity is the single most common way this claim is faked. And read the disclosure section: a current registration is not an endorsement."
},

"SEC Form D": {
  info: ["US","A","The notice a company files when it raises money privately without registering the offering. It carries the first filing date, the first sale date, how much was offered, how much was sold, and who is named on it.","https://www.sec.gov/edgar/search/"],
  hit: "The offering was notified to the SEC. The first sale date is the most useful figure on it, because it is an independent record of when money actually started moving.",
  miss: "No exempt offering notice was located. A private raise into United States investors normally leaves one. Its absence is a question to put to them, not a finding on its own.",
  look: "Compare the date of first sale with whatever they told you about how long they have been raising. A gap is a discrepancy to ask about. It is not, by itself, evidence of wrongdoing."
},

"ASIC Professional Register": {
  info: ["AU","A","The Australian Securities and Investments Commission's register of financial services and credit licensees, authorised representatives and the people responsible for them.","https://asic.gov.au/online-services/search-asics-registers/"],
  hit: "An Australian licence or authorisation exists. It states the licence type, what it permits, who the responsible people are, and whether it is current or historical.",
  miss: "No Australian licence was located. That matters if they are soliciting Australians and is irrelevant if they are not.",
  look: "Read the permissions, not only the number. A licence to do one thing is routinely waved around as authority to do another."
},

"SFC Public Register": {
  info: ["HK","A","Hong Kong's Securities and Futures Commission register of licensed corporations, licensed people and responsible officers, with the regulated activities each is licensed for.","https://www.sfc.hk/en/Regulatory-functions/Intermediaries/Licensing/"],
  hit: "A Hong Kong licence exists, with the regulated activity types and the named responsible officers.",
  miss: "No Hong Kong licence was located under the names searched.",
  look: "The regulated activity types. Type 1 dealing is not Type 9 asset management, and a firm licensed for one and selling the other is operating outside its licence."
},

"ESMA MiCA CASP": {
  info: ["EU","A","The European authorisation record for crypto asset service providers under the Markets in Crypto Assets regulation. Names the legal entity, the member state that authorised it and which crypto services it may provide.","https://www.esma.europa.eu/"],
  hit: "An EU crypto authorisation exists, naming the member state and the specific services permitted.",
  miss: "No EU crypto authorisation was located. For a party offering crypto exchange, custody, brokerage or transfer to people in the EU, that is a direct question.",
  look: "Which services are authorised. Custody and exchange are separate permissions, and a firm holding one frequently advertises both."
},

"IOSCO I-SCAN": {
  info: ["GLOBAL","A","The investor alerts portal carrying warnings from more than ninety national authorities in one place.","https://www.iosco.org/i-scan/"],
  hit: "An entry from a national securities authority warning about this party.",
  miss: "No entry across the contributing authorities.",
  look: "Which authority posted it, and when. A warning from the regulator in your own country matters most to you."
},

"BCSC Caution List": {
  info: ["CA-BC","A","British Columbia's Investment Caution List.","https://www.bcsc.bc.ca/enforcement/early-intervention/investment-caution-list"],
  hit: "British Columbia has publicly cautioned about this party.",
  miss: "No BC entry.",
  look: "The date and the wording. These lists say exactly why."
},

"ASC Caution List": {
  info: ["CA-AB","A","Alberta's Investment Caution List.","https://www.asc.ca/en/enforcement/investment-caution-list"],
  hit: "Alberta has publicly cautioned about this party.",
  miss: "No Alberta entry.",
  look: "The date and the wording."
},

"OSC Alerts": {
  info: ["CA-ON","A","Ontario Securities Commission investor warnings.","https://www.osc.ca/en/investors/investor-warnings"],
  hit: "Ontario has issued an investor warning about this party.",
  miss: "No Ontario entry.",
  look: "The date and the wording."
},

"CSA Alerts": {
  info: ["CA","A","Every province's investor alerts, collected.","https://www.securities-administrators.ca/investor-alerts/"],
  hit: "At least one Canadian province has warned about this party.",
  miss: "No entry in any province's alerts.",
  look: "A listing here is a finding. It is a regulator saying, in public and in its own name, that something is wrong."
},

"FCA Warning List": {
  info: ["UK","A","Firms the Financial Conduct Authority has warned about.","https://www.fca.org.uk/consumers/warning-list-unauthorised-firms"],
  hit: "The United Kingdom regulator has warned about this firm.",
  miss: "No entry.",
  look: "The FCA lists clone firms too. Check whether the warning is about this firm or about somebody impersonating it."
},

"OFAC": {
  info: ["US","A","The United States sanctions list. A match here stops the assessment being advisory.","https://sanctionssearch.ofac.treas.gov/"],
  hit: "A match against the United States sanctions list.",
  miss: "No match.",
  look: "A real match stops everything. Names are common, so confirm the identifiers rather than the name alone."
},

"UN Consolidated": {
  info: ["GLOBAL","A","The United Nations Security Council consolidated sanctions list.","https://www.un.org/securitycouncil/content/un-sc-consolidated-list"],
  hit: "A match against the United Nations sanctions list.",
  miss: "No match.",
  look: "Same as OFAC. Confirm identifiers, not names."
},

"DOJ Press": {
  info: ["US","A","Department of Justice announcements. Arrests, indictments, pleas and forfeitures are published here before anywhere else.","https://www.justice.gov/news"],
  hit: "The Department of Justice has published something naming this party. Arrests, indictments, pleas and forfeitures appear here first.",
  miss: "Nothing published. Most cases are charged long after the money is gone, so this absence proves very little.",
  look: "Read the verb. Charged is an allegation. Pleaded guilty is an admission. They are not the same and the difference is the whole story."
},

"IRS-CI": {
  info: ["US","A","IRS Criminal Investigation. Publishes its own releases on financial crime cases it worked.","https://www.irs.gov/compliance/criminal-investigation"],
  hit: "IRS Criminal Investigation has published on a case involving this party.",
  miss: "Nothing published.",
  look: "These releases carry dollar figures and dates that no other source has."
},

"State AG": {
  info: ["US","A","State attorneys general and state securities regulators. Where a state acts before a federal authority does.",""],
  hit: "A state attorney general or securities regulator has acted.",
  miss: "Nothing found in the states searched.",
  look: "States often act months before a federal authority does. An action in one state is worth as much as a federal one."
},

"SEC Trading Suspensions": {
  info: ["US","A","Securities the SEC has suspended from trading, with the release number and the reason it gave. The SEC suspends a security when it considers it necessary to protect investors.","https://www.sec.gov/litigation/suspensions"],
  hit: "This is as serious as this board gets. The regulator stopped trading in the security. Read the release: it states what the concern was.",
  miss: "No suspension was located for the names or tickers searched. Most securities are never suspended, so this is the expected result and it clears nothing.",
  look: "The date and the release number, then open the release itself. A suspension is temporary; what it says about the reason is not."
},

"CFTC RED List": {
  info: ["US","A","The Commodity Futures Trading Commission's Registration Deficient list. Foreign entities that appear to be soliciting United States residents for futures, options, forex or similar, and that are not registered.","https://www.cftc.gov/check"],
  hit: "The regulator has publicly named this party as apparently soliciting Americans without the registration that would require. For a retail trading offer this is close to decisive.",
  miss: "Not on the RED list. The list only covers entities the CFTC has looked at and only covers its own remit, so absence is weak.",
  look: "Check the website and the aliases as well as the name. These operations rebrand constantly and the list records the domains."
},

"CFTC Enforcement": {
  info: ["US","A","Civil actions, administrative proceedings and orders brought by the CFTC against firms and people, in futures, commodities, forex and increasingly crypto.","https://www.cftc.gov/LawRegulation/Enforcement/index.htm"],
  hit: "There is a proceeding. Read whether it is a complaint or an order: a complaint contains allegations that have not been proven, an order or consent judgment contains findings. They are not the same thing and this board keeps them apart.",
  miss: "No CFTC action was located against the entity or the people named.",
  look: "The names of the individuals, not only the company. People carry their history into the next company; a shell does not."
},

"DFPI Crypto Scam Tracker": {
  info: ["US-CA","B","A public database run by California's Department of Financial Protection and Innovation, built from complaints Californians filed about crypto operations. Government published, but the underlying accounts are consumer reports.","https://dfpi.ca.gov/crypto-scams/"],
  hit: "A consumer reported this party, or this website, to a state regulator. That is meaningful and it is still a complaint, not a finding. It is recorded here as a government published consumer report and it is treated as consumer evidence, not as an adjudicated result.",
  miss: "No entry located. The tracker only holds what Californians reported, so absence says very little.",
  look: "The narrative and the date. Read what was actually done to the person, and whether the same mechanic appears in the reviews check."
},

"CIRO Discipline": {
  info: ["CA","A","Disciplinary proceedings, settlement agreements and sanctions issued by the Canadian Investment Regulatory Organization against member firms and the people registered through them.","https://www.ciro.ca/office-corporate-secretary/enforcement"],
  hit: "A firm or a person has been disciplined. You get the allegations, the decision, any settlement and the sanctions.",
  miss: "No disciplinary record located. Kept separate from AdvisorReport deliberately, because a clean current registration and a clean disciplinary history are two different questions.",
  look: "Whether the person was registered at the time and through which firm. That is how a disciplinary history connects to the entity you are actually being asked to pay."
},

"ASIC Investor Alerts": {
  info: ["AU","A","Warnings published by the Australian regulator about companies and websites believed to be operating without a licence or targeting Australians improperly.","https://moneysmart.gov.au/check-and-report-scams/investor-alert-list"],
  hit: "An Australian regulator has published a warning naming this party or its website. Read the exact wording: it says what the concern is.",
  miss: "Not on the list. It carries what ASIC has published, which is a fraction of what exists.",
  look: "The website and the aliases. The same operation appears on these lists repeatedly under new names."
},

"SFC Alert List": {
  info: ["HK","A","Hong Kong's list of suspicious websites, unlicensed companies and entities impersonating licensed firms.","https://www.sfc.hk/en/alert-list"],
  hit: "The SFC has classified this party or its website. The classification itself is the finding: impersonation of a licensed firm is a different problem from operating unlicensed.",
  miss: "Not listed.",
  look: "The classification the SFC used, and whether the entry names a firm being impersonated. If it does, the real firm is not the one you are dealing with."
},

"ISC Ownership": {
  info: ["CA","A","Individuals with significant control. Who actually owns a Canadian company.",""],
  hit: "A record of who actually controls the company.",
  miss: "No ownership record retrieved.",
  look: "Compare the named owner to the person you are dealing with."
},

"UK PSC Register": {
  info: ["UK","A","Persons with significant control over a United Kingdom company.","https://find-and-update.company-information.service.gov.uk/"],
  hit: "Persons with significant control over a UK company.",
  miss: "No record.",
  look: "A company with no person of significant control declared is worth a question."
},

"ASIC Banned": {
  info: ["AU","A","Australia's register of banned and disqualified persons.","https://asic.gov.au/online-services/search-asics-registers/banned-and-disqualified/"],
  hit: "An Australian ban or disqualification against this person.",
  miss: "No entry.",
  look: "The period of the ban and what it covers."
},

"CSA Disciplined": {
  info: ["CA","A","The disciplined persons list maintained across Canadian securities regulators.","https://www.securities-administrators.ca/disciplined-persons-list/"],
  hit: "A Canadian securities regulator has disciplined this person.",
  miss: "No entry.",
  look: "What they were disciplined for, and when."
},

"CSA Disciplined Persons": {
  info: ["CA","A","The national list of people disciplined by any Canadian securities regulator, searchable by name across provinces.","https://www.securities-administrators.ca/disciplined-persons/"],
  hit: "A person connected to this party has been disciplined by a Canadian securities regulator. Person level history follows the person into every company they are involved with.",
  miss: "No disciplined person record located under the names searched. Only works if you have the right names and the right spellings.",
  look: "Match the full name and the province, then read what the person actually did. A name collision is common and the record itself will settle it."
},

"SEDI Insider Reports": {
  info: ["CA","A","Canada's System for Electronic Disclosure by Insiders. Directors, officers and significant shareholders must report what they hold and every trade they make.","https://www.sedi.ca/"],
  hit: "Insider filings exist. You get who the insiders are, their relationship to the issuer, what they hold and every acquisition and disposition with dates.",
  miss: "No insider filings located. Expected for a private company; a real question for one claiming to be a Canadian reporting issuer.",
  look: "The relationship field, which tells you who actually controls the issuer, and the earliest filing date, which is an independent record of when this became a reporting issuer."
},

"CanLII": {
  info: ["CA","A","Canadian court and tribunal decisions.","https://www.canlii.org/"],
  hit: "A Canadian court or tribunal decision involving this party.",
  miss: "Nothing found.",
  look: "Check which side they are on. A defendant and a plaintiff are not the same thing."
},

"OSB Bankruptcy": {
  info: ["CA","A","The Office of the Superintendent of Bankruptcy insolvency records.","https://www.ic.gc.ca/app/scr/bsf-osb/ins/login.html"],
  hit: "A Canadian insolvency record.",
  miss: "No record.",
  look: "Whether it is closed or ongoing."
},

"CourtListener": {
  info: ["US","B","A free archive of United States court opinions and dockets.","https://www.courtlistener.com/"],
  hit: "A United States court opinion or docket.",
  miss: "Nothing found.",
  look: "An opinion is a decision. A docket entry is a filing, and a filing is only an assertion."
},

"UK Insolvency": {
  info: ["UK","A","The Insolvency Service register.","https://www.gov.uk/search-bankruptcy-insolvency-register"],
  hit: "A UK bankruptcy or insolvency record.",
  miss: "No record.",
  look: "Status and date."
},

"PACER": {
  info: ["US","A","Public access to federal court electronic records. The dockets themselves.","https://pacer.uscourts.gov/"],
  hit: "A United States federal court docket.",
  miss: "Nothing found.",
  look: "The case number and the parties. Read the caption before the allegations: it tells you who is suing whom."
},

"Justia Dockets": {
  info: ["US","B","Docket aggregators. Fast to search; the court record is the authority.","https://dockets.justia.com/"],
  hit: "A docket found through an aggregator.",
  miss: "Nothing found.",
  look: "Use it to locate the case, then read the court's own record. The aggregator can be out of date."
},

"Bankruptcy Claims": {
  info: ["US","B","Claims agent sites carrying the full docket, examinations and creditor claims for a bankruptcy or receivership.",""],
  hit: "A claims agent site for a bankruptcy or receivership, carrying the full docket.",
  miss: "No proceeding found.",
  look: "If your money is in it, the claims deadline on that site is the most important date on this page."
},

"SEDAR+": {
  info: ["CA","A","The filing system for Canadian public companies and investment funds. Prospectuses, financial statements, management discussion and analysis, material change reports and cease trade documents.","https://www.sedarplus.ca/"],
  hit: "The issuer files in Canada. The filings describe the business in its own regulated words, which is the version it had to sign.",
  miss: "No SEDAR+ filings located. For a party describing itself as a Canadian public company or reporting issuer, that is a contradiction to resolve before anything else.",
  look: "The earliest filing date, and how the business described itself in each year. A company that told a regulator it was pre revenue in 2024 and tells you it has been trading profitably since 2022 has given two different accounts and you are entitled to ask which is correct."
},

"ICANN RDAP": {
  info: ["GLOBAL","A","The registry record for a domain. Registrar, nameservers, status and the creation date.","https://rdap.org/"],
  hit: "The registry record for the domain: registrar, nameservers, status and creation date.",
  miss: "The registry did not answer. It almost always does, so a failure here usually means a temporary problem rather than a missing domain.",
  look: "The creation date. Everything else on this page can be argued about. That date cannot."
},

"Certificate Log": {
  info: ["GLOBAL","B","Certificate transparency. Every certificate ever issued for a host, with its date.","https://crt.sh/"],
  hit: "Every certificate ever issued for this host, with dates.",
  miss: "No certificates found.",
  look: "The earliest date. A site cannot have been serving securely before its first certificate."
},

"Google Web Risk": {
  info: ["GLOBAL","B","Google's assessment of whether a site is known to be unsafe.","https://transparencyreport.google.com/safe-browsing/search"],
  hit: "Google has flagged this site as unsafe.",
  miss: "Not flagged.",
  look: "Not flagged means not yet flagged. New fraud sites are almost never flagged."
},

"VirusTotal": {
  info: ["GLOBAL","B","Aggregated reputation across many security vendors.","https://www.virustotal.com/"],
  hit: "Security vendors have flagged this domain.",
  miss: "No detections.",
  look: "Look at how many vendors, not whether any. One detection out of ninety is usually noise."
},

"urlscan.io": {
  info: ["GLOBAL","B","A recorded scan of what a page actually loads and where it sends data.","https://urlscan.io/"],
  hit: "A recorded scan of what the page loads and where it sends data.",
  miss: "No scan available.",
  look: "Where the forms post to. A payment form posting to a different domain is worth understanding."
},

"Mail Config": {
  info: ["GLOBAL","A","The domain's mail routing and sender policy. Shows whether a real mailbox exists on the domain.",""],
  hit: "The domain has mail routing, so a real mailbox exists on it.",
  miss: "No mail configuration. A company writing to you from a domain that cannot receive mail is a question.",
  look: "Whether the address they emailed you from is actually on this domain."
},

"Trustpilot": {
  info: ["GLOBAL","C","A consumer review platform. Read for the one and two star accounts, never for the average.","https://www.trustpilot.com/"],
  hit: "Reviews exist on Trustpilot.",
  miss: "No profile or no reviews.",
  look: "Read the one and two star reviews only, and read them for the same complaint recurring rather than for the average."
},

"Sitejabber": {
  info: ["GLOBAL","C","A consumer review platform with a different user base from Trustpilot.","https://www.sitejabber.com/"],
  hit: "Reviews exist on Sitejabber.",
  miss: "No profile or no reviews.",
  look: "A different user base from Trustpilot. The same complaint appearing on both is worth far more than either alone."
},

"BBB Scam Tracker": {
  info: ["US-CA","C","Better Business Bureau complaints and scam reports.","https://www.bbb.org/scamtracker"],
  hit: "A Better Business Bureau profile or scam report exists.",
  miss: "No profile.",
  look: "The BBB letter rating is mostly age and complaint volume. It is not a safety endorsement. Read the complaints instead."
},

"Forex Peace Army": {
  info: ["GLOBAL","C","Trading community reviews. Strong on withdrawal complaints specifically.","https://www.forexpeacearmy.com/"],
  hit: "Trading community reviews exist.",
  miss: "No entry.",
  look: "This community is unusually good on withdrawal complaints specifically."
},

"Reddit": {
  info: ["GLOBAL","D","Community intelligence. Never verified fact, and never a finding on its own.","https://www.reddit.com/r/CryptoScams/"],
  hit: "Community discussion exists.",
  miss: "None found.",
  look: "Community intelligence, never verified fact. Useful for the mechanic being described, not for the conclusion being drawn."
},

"Glassdoor": {
  info: ["GLOBAL","C","Employee accounts. Sometimes the earliest signal that an operation is not what it says.","https://www.glassdoor.com/"],
  hit: "Employee accounts exist.",
  miss: "No profile.",
  look: "Sometimes the earliest signal. Employees describe how an operation actually works before customers can."
},

"Beneficiary Match": {
  info: ["4orm","A","Does the name on the receiving account match the party you are dealing with. Needs a payment instruction from you.",""],
  hit: "The name on the receiving account was compared to the party.",
  miss: "No payment instruction was supplied, so nothing could be compared.",
  look: "This is the check that most often stops a payment in time, and it needs the instruction from you."
},

"IBAN and SWIFT": {
  info: ["GLOBAL","B","Validates the account and identifies the receiving institution and country.",""],
  hit: "The account and receiving institution were validated.",
  miss: "No instruction supplied.",
  look: "Which country the receiving bank is in. It should make sense against where the company says it is."
},

"Chainabuse": {
  info: ["GLOBAL","C","Community reported wallet addresses.","https://www.chainabuse.com/"],
  hit: "Community reports exist against this wallet address.",
  miss: "No reports.",
  look: "Reports are allegations. Several independent reports of the same pattern are worth taking seriously."
},

"Chain Analytics": {
  info: ["GLOBAL","B","On chain tracing of a wallet address and its counterparties.",""],
  hit: "On chain tracing of the address and its counterparties.",
  miss: "Not run or unavailable.",
  look: "Where funds move after they arrive."
},

"Etherscan": {
  info: ["Chain","B","The public record of the Ethereum blockchain and compatible chains. Every transaction, every contract, every token transfer, with dates.","https://etherscan.io/"],
  hit: "The address exists on chain and you can see what moved and when. First activity is an independent date. Ownership is not on the chain and cannot be read off it.",
  miss: "Nothing found for the address supplied. Check the chain: an address that is empty on Ethereum may be active on another network.",
  look: "First activity date, and whether funds move straight out to an exchange. A payment address created days before you were asked to use it is a fact worth having."
},

"Solscan": {
  info: ["Chain","B","The public record of the Solana blockchain: transactions, token accounts and program interactions.","https://solscan.io/"],
  hit: "The address exists and its activity is visible with dates.",
  miss: "Nothing found on Solana for the address supplied.",
  look: "First activity, and the age of the account against the age of the story you were told."
},

"Tronscan": {
  info: ["Chain","B","The public record of the Tron blockchain. Matters more than its size suggests, because a great deal of USDT moves on Tron and many payment demands specify it.","https://tronscan.org/"],
  hit: "The address exists on Tron and its transfers are visible with dates and amounts.",
  miss: "Nothing found on Tron for the address supplied.",
  look: "Whether USDT arrives and leaves within minutes. That is a pass through pattern and it tells you the address is not a destination."
},

"Bitcoin Explorer": {
  info: ["Chain","B","The public record of the Bitcoin blockchain: addresses, transactions, amounts and dates.","https://www.blockchain.com/explorer"],
  hit: "The address exists and its history is visible.",
  miss: "Nothing found for the address supplied.",
  look: "First and last activity, and the amounts. A brand new address given to you as an established company's payment address is a contradiction."
},

"Infrastructure Cluster": {
  info: ["4orm","4orm","Other domains sharing nameservers, registrar or hosting with this one. Built from every previous check.",""],
  hit: "Other domains share nameservers, registrar or hosting with this one.",
  miss: "No cluster found.",
  look: "Shared infrastructure alone is common and innocent. Shared infrastructure with a party already found adverse is not."
},

"Identifier Reuse": {
  info: ["4orm","4orm","The same phone, email, address or wallet appearing under a different brand name.",""],
  hit: "The same phone, email, address or wallet appears under another brand name.",
  miss: "No reuse found.",
  look: "One operator running several brands is the pattern this looks for."
},

"Document Fingerprint": {
  info: ["4orm","4orm","A document matching one submitted under another party's name.",""],
  hit: "A document matching one submitted under another party's name.",
  miss: "No match.",
  look: "The same contract template under two different company names is worth a question."
},

"Analytics and Pixel Reuse": {
  info: ["4orm","B","A search of website source code for exact identifiers: Google Analytics properties, Tag Manager containers, Meta pixels, unique scripts, phone numbers and code fragments. Finds other sites carrying the same ones.","https://publicwww.com/"],
  hit: "Another website carries an identifier that somebody had to configure on this one. That is a real connection between two builds. It is not proof of a shared operator, and this board never reports it as one.",
  miss: "No other site was found carrying these identifiers. It does not mean none exists: this searches an index, not the whole web.",
  look: "Whether the identifier is a configured property or a placeholder that shipped with the template. A default container id connects nothing."
},

"Site Technology": {
  info: ["4orm","B","What a website is built from: analytics, pixels, hosting, embedded services and payment technology. Used to extract identifiers and to corroborate them.","https://builtwith.com/"],
  hit: "The site's technology stack and its embedded identifiers are on record, which is where the reusable identifiers come from.",
  miss: "No technology profile located for this domain.",
  look: "The payment technology. How a site is set up to take money says more about it than what it says about itself."
},

"DNS and IP History": {
  info: ["4orm","B","The history of a domain's DNS records: which addresses it has resolved to, which nameservers it has used, and which other domains have shared them.","https://securitytrails.com/"],
  hit: "The domain's infrastructure history is visible, including addresses and neighbours it no longer uses. A shared mass market host means nothing; a shared small private host is a real signal.",
  miss: "No history retrieved, often because this needs a key we do not have configured. That is published as a gap, never as clean.",
  look: "Whether the neighbours are on a mass market provider. Thousands of unrelated sites share a Cloudflare nameserver and that connects nobody to anybody."
},

"Host and Certificate Graph": {
  info: ["4orm","B","Internet wide scan data: hosts, TLS certificates and the relationships between them, including historical infrastructure.","https://censys.io/"],
  hit: "The host and certificate relationships are on record, which extends the certificate check in category 06 into a map rather than a single date.",
  miss: "No scan data retrieved. Often a missing key, and it is published as a gap.",
  look: "Certificates covering several unrelated brand names at once. One certificate issued for four brands is one operator running four brands."
},

"Wallet Reuse": {
  info: ["4orm","4orm","Our own record of payment addresses supplied by parties we have checked before. Answers one question: has this address been given to somebody else, by somebody else.",""],
  hit: "This payment address has appeared in a previous check under a different name. Of everything on this board, this is the hardest to explain innocently.",
  miss: "This address has not appeared in our records before. On a young corpus that mostly means we have not seen it, not that it is new.",
  look: "The other name it appeared under, and the date. Both are shown."
},

"Beneficiary Reuse": {
  info: ["4orm","4orm","Our own record of receiving account names, IBANs and bank references taken from payment instructions supplied to us. Answers whether the money goes where somebody else's money went.",""],
  hit: "The receiving party on this payment instruction has received money on behalf of a different named company before. The name on the account is the thing to look at, not the company on the invoice.",
  miss: "This beneficiary has not appeared in our records before.",
  look: "Whether the account name matches the company you are being asked to pay. A mismatch is the single most reliable signal on this entire board."
},

"People Cluster": {
  info: ["4orm","4orm","Our own record of the people found in previous checks: directors, officers, promoters and advisers, and the entities each of them was attached to.",""],
  hit: "A person connected to this party appears in our records against another entity. The connection is shown with the record that established it, in both directions.",
  miss: "No person connected to this party appears elsewhere in our records.",
  look: "Whether the earlier entity attracted a regulator warning. That is the connection worth the most, and it is stated separately when it exists."
},

"Operator Graph": {
  info: ["4orm","4orm","The whole of it: every identifier this party controls, every edge between them, and every other party sharing one. Each edge carries how specific the identifier is and the record it was read from.",""],
  hit: "Identifiers connect this party to others. One connection is interesting. Two independent connections are material. Three or more high specificity connections are strong, and every one is listed with its source.",
  miss: "No identifier connects this party to any other party in our records. That is not evidence of anything either way.",
  look: "The specificity column. A shared wallet and a shared web host are both connections and they are not remotely the same claim."
},

"ICANN RDAP Date": {
  info: ["GLOBAL","A","The domain creation date, from the registry record. The single most decisive date in the check, and never inferred from anything else.","https://rdap.org/"],
  hit: "The registry creation date for the domain.",
  miss: "The registry did not answer.",
  look: "Compare it to every dated claim on their site. A result from before this date cannot have happened here."
},

"Wayback Machine": {
  info: ["GLOBAL","B","The first archived capture of the site. Establishes the earliest date the site was demonstrably being published.","https://web.archive.org/"],
  hit: "The earliest archived capture of the site.",
  miss: "No capture found.",
  look: "An archive gap is an archive gap. It is weaker evidence than a registry date and should never be treated as one."
},

"First Certificate": {
  info: ["GLOBAL","B","The first certificate ever issued for this host. A certificate can post-date a site, so this is corroborating rather than decisive.","https://crt.sh/"],
  hit: "The first certificate issued for this host.",
  miss: "No certificate history found.",
  look: "Corroborates the domain date. A certificate can post-date a site, so it is supporting evidence rather than proof."
},

"Trademark Filing": {
  info: ["US","A","The filing date of the mark. A brand claiming a long history usually filed early.","https://tsdr.uspto.gov/"],
  hit: "A trademark filing exists, with its date.",
  miss: "No filing found.",
  look: "A brand claiming a long history usually filed early. No filing at all is not unusual for a small business."
},

"Domain History": {
  info: ["GLOBAL","B","Passive DNS and historical records for the domain, including previous owners and configurations.",""],
  hit: "Historical records for the domain, including previous owners.",
  miss: "No history retrieved.",
  look: "Whether the domain changed hands. A domain bought second hand carries an older creation date that is not the company's age."
},

"Incorporation Date": {
  info: ["VARIES","A","When the legal entity itself first existed, from its home registry. Nothing the company did can predate this.",""],
  hit: "When the legal entity first existed.",
  miss: "No incorporation record retrieved.",
  look: "Nothing the company did can predate this. It is the hardest date to argue with."
},

"Public Profile": {
  info: ["GLOBAL","D","Stated tenure and history on public professional profiles. Self reported, and treated as such.",""],
  hit: "A stated tenure or history on a public professional profile.",
  miss: "No profile found.",
  look: "Self reported, and treated as such. Useful as a claim to check, never as a record."
},

"Form D First Filing": {
  info: ["US","A","The date the first exempt offering notice was filed with the SEC. An independent record of when a private raise was first notified.","https://www.sec.gov/edgar/search/"],
  hit: "There is a first filing date on the record, filed by them.",
  miss: "No Form D located, so this comparison cannot be made and it is published as a gap.",
  look: "The gap between this date and any claimed fundraising history. A gap is a discrepancy to explain, not proof of anything."
},

"Form D First Sale": {
  info: ["US","A","The date of first sale as stated on the Form D. An independent record of when money actually started coming in.","https://www.sec.gov/edgar/search/"],
  hit: "The party stated to the SEC when its first sale occurred. That is a strong date because they filed it themselves.",
  miss: "No first sale date located.",
  look: "This against the marketing. A fund claiming to have been raising since 2019 with a first sale in 2025 has two accounts of itself and owes you the reconciliation."
},

"EDGAR First Filing": {
  info: ["US","A","The earliest filing of any kind made to the SEC under this name. The first date the party appears in the federal securities record.","https://www.sec.gov/edgar/search/"],
  hit: "There is a first appearance date in the federal record.",
  miss: "The party has never filed with the SEC under the names searched.",
  look: "Whether the first appearance is consistent with the history claimed on the website."
},

"SEDAR+ First Filing": {
  info: ["CA","A","The earliest filing on SEDAR+. When the issuer first appears in the Canadian securities record.","https://www.sedarplus.ca/"],
  hit: "There is a first filing date, and the filings around it describe what stage the business was actually at.",
  miss: "No SEDAR+ record, so this date is unavailable and published as a gap.",
  look: "Read more than the date. Read how the company described itself in the earliest filings, because that description was made to a regulator."
},

"SEDI First Insider Record": {
  info: ["CA","A","The earliest insider report filed against the issuer. When the issuer first had reportable insiders.","https://www.sedi.ca/"],
  hit: "There is a first insider record date.",
  miss: "No insider records, expected for a private company.",
  look: "The date, against a claim to have been a public or reporting issuer earlier than that."
},

"IAPD First Registration": {
  info: ["US","A","The date an adviser first registered with the SEC or a state, from the Form ADV history.","https://adviserinfo.sec.gov/"],
  hit: "There is a first registration date on the record.",
  miss: "No adviser registration history located.",
  look: "Registration date against claimed years of managing money. Advising before registering is a licensing question as well as a dating one."
},

"App Store First Release": {
  info: ["Store","B","The first release date of an app on Apple's App Store, and its version history.","https://www.apple.com/app-store/"],
  hit: "The app has a first release date recorded by Apple.",
  miss: "No App Store listing located under the names searched.",
  look: "The first release date, and the developer name. The developer account is often shared across several brands."
},

"Google Play First Release": {
  info: ["Store","B","The first release date of an Android app and its update history.","https://play.google.com/"],
  hit: "The app has a first release date recorded by Google.",
  miss: "No Play listing located.",
  look: "The developer name and the release date. A platform claiming years of users with an app released last quarter is a contradiction."
},

"GitHub Repository Created": {
  info: ["Build","B","The creation date of a public code repository. For anything claiming to have built technology, an independent record of when the work started.","https://github.com/"],
  hit: "A repository exists with a creation date.",
  miss: "No public repository located. Plenty of real companies keep code private, so this proves nothing on its own.",
  look: "The creation date against the claimed development history, and whether the account contributes to other projects under other brands."
},

"GitHub First Commit": {
  info: ["Build","B","The date of the earliest commit in a repository. Harder to backdate convincingly than a website.","https://github.com/"],
  hit: "There is a first commit date.",
  miss: "No commit history retrieved.",
  look: "Whether the entire history was committed on one day. A project with three years of claimed development and one commit is a copy, not a history."
},

"First Press Release": {
  info: ["Wire","D","The earliest press release issued under this name on a commercial wire service.",""],
  hit: "There is an earliest dated announcement. It is the party's own promotional material, so it is weak evidence of anything except the date.",
  miss: "No press release located.",
  look: "The date only. The contents are marketing."
},

"First YouTube Video": {
  info: ["Social","D","The earliest video published on the party's channel.","https://www.youtube.com/"],
  hit: "There is an earliest publication date on the channel.",
  miss: "No channel located.",
  look: "The date, and whether the channel history matches the claimed trading history. Both are easy to check and easy to compare."
},

"First Social Post": {
  info: ["Social","D","The earliest post on the party's own social account, and when the account was created.",""],
  hit: "There is an account creation date and an earliest post.",
  miss: "No account located under the names searched.",
  look: "The account creation date. It is the weakest date on this list and it is still a date somebody else recorded."
}
};

export default REFERENCE;
