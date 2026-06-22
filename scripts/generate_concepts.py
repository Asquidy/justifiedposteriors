import re,glob,os,html,yaml
from collections import OrderedDict

# concept -> (category, regex)
CONCEPTS = [
 # Growth & Production Theory
 ("Task-based framework (Acemoglu-Restrepo)","Growth & Production Theory",r"task[- ]based|acemoglu.{0,15}restrepo|\brestrepo\b"),
 ("Production functions","Growth & Production Theory",r"production function"),
 ("Total factor productivity (TFP)","Growth & Production Theory",r"\bTFP\b|total factor productivity"),
 ("Economics of superstars","Growth & Production Theory",r"superstar"),
 ("CES production function","Growth & Production Theory",r"\bCES\b|constant elasticity of substitution"),
 ("Nested CES","Growth & Production Theory",r"nested CES"),
 ("Cobb-Douglas","Growth & Production Theory",r"cobb[- ]?douglas"),
 ("O-ring theory","Growth & Production Theory",r"o[- ]ring"),
 ("Baumol's cost disease","Growth & Production Theory",r"baumol"),
 ("Capital deepening","Growth & Production Theory",r"capital deepening"),
 ("Knowledge spillovers","Growth & Production Theory",r"spillover"),
 ("Returns to scale","Growth & Production Theory",r"returns to scale"),
 ("AK / endogenous growth","Growth & Production Theory",r"\bAK (model|economy)\b|endogenous growth|explosive growth"),
 ("Ideas getting harder to find / fishing out","Growth & Production Theory",r"harder to find|fishing out"),
 ("Solow growth model","Growth & Production Theory",r"\bsolow\b"),
 ("Malthusian ceiling","Growth & Production Theory",r"malthus"),
 ("Skill-biased technical change","Growth & Production Theory",r"skill[- ]biased"),
 ("Learning-by-doing","Growth & Production Theory",r"learning[- ]by[- ]doing"),
 ("Turing Trap","Growth & Production Theory",r"turing trap"),
 ("Creative destruction","Growth & Production Theory",r"creative destruction"),
 # Microeconomics & IO
 ("Complements vs. substitutes","Microeconomics & Industrial Organization",r"complement|substitut"),
 ("Marginal analysis (cost/product/utility)","Microeconomics & Industrial Organization",r"marginal (cost|product|utility|revenue|rate)"),
 ("General equilibrium","Microeconomics & Industrial Organization",r"general equilibrium|equilibrium effect"),
 ("Elasticity","Microeconomics & Industrial Organization",r"\belasticit"),
 ("Auctions & procurement","Microeconomics & Industrial Organization",r"auction|procurement"),
 ("Coasean bargaining","Microeconomics & Industrial Organization",r"coasean|\bcoase\b"),
 ("Bargaining","Microeconomics & Industrial Organization",r"bargain"),
 ("Market power / monopoly","Microeconomics & Industrial Organization",r"market power|monopoly|monopolist"),
 ("Monopsony","Microeconomics & Industrial Organization",r"monopson"),
 ("Assortative matching","Microeconomics & Industrial Organization",r"assortative"),
 ("Sorting","Microeconomics & Industrial Organization",r"\bsorting\b"),
 ("Mechanism design","Microeconomics & Industrial Organization",r"mechanism design"),
 ("Antitrust","Microeconomics & Industrial Organization",r"antitrust"),
 ("Collusion","Microeconomics & Industrial Organization",r"collusion|collude|colluding"),
 ("Property rights","Microeconomics & Industrial Organization",r"property right"),
 ("Two-sided markets / platforms","Microeconomics & Industrial Organization",r"two[- ]sided market|platform"),
 ("Network effects","Microeconomics & Industrial Organization",r"network effect"),
 ("Transaction costs","Microeconomics & Industrial Organization",r"transaction cost"),
 ("Preferential attachment","Microeconomics & Industrial Organization",r"preferential attachment"),
 # Labor
 ("Human capital","Labor Economics",r"human capital"),
 ("Automation vs. augmentation","Labor Economics",r"augment|\bautomat"),
 ("Comparative advantage","Labor Economics",r"comparative advantage"),
 ("Labor-market matching","Labor Economics",r"matching (function|model|market)|labor market match|search friction"),
 ("Structural unemployment / skill mismatch","Labor Economics",r"structural unemployment|skill mismatch"),
 ("Universal Basic Income (UBI)","Labor Economics",r"\bUBI\b|universal basic income"),
 ("Elite overproduction","Labor Economics",r"elite overproduction"),
 ("Trade Adjustment Assistance","Labor Economics",r"trade adjustment|adjustment assistance"),
 ("Wage insurance","Labor Economics",r"wage insurance"),
 ("Efficiency wages","Labor Economics",r"efficiency wage"),
 # Macro / welfare / public
 ("GDP & growth","Macro, Welfare & Public Economics",r"\bGDP\b"),
 ("Real interest rates","Macro, Welfare & Public Economics",r"real interest rate|interest rate"),
 ("Consumer / social surplus & welfare","Macro, Welfare & Public Economics",r"consumer surplus|social surplus|total surplus|welfare"),
 ("Inequality","Macro, Welfare & Public Economics",r"inequalit"),
 ("Externalities","Macro, Welfare & Public Economics",r"externalit"),
 ("Redistribution","Macro, Welfare & Public Economics",r"redistribut"),
 ("Saving / dissaving","Macro, Welfare & Public Economics",r"dissaving|saving rate|savings rate"),
 ("Demand collapse / satiation","Macro, Welfare & Public Economics",r"demand collapse|satiat"),
 ("Piketty / r > g","Macro, Welfare & Public Economics",r"piketty|r ?> ?g|r greater than g"),
 ("Marginal propensity to consume (MPC)","Macro, Welfare & Public Economics",r"\bMPC\b|marginal propensity to consume"),
 ("Optimal taxation","Macro, Welfare & Public Economics",r"optimal tax"),
 ("Sovereign wealth funds","Macro, Welfare & Public Economics",r"sovereign wealth"),
 ("Industrial policy","Macro, Welfare & Public Economics",r"industrial policy"),
 ("Pigouvian taxes","Macro, Welfare & Public Economics",r"pigou"),
 ("Georgist / land value tax","Macro, Welfare & Public Economics",r"georgis|land value tax|\bland tax\b|unimproved land"),
 ("Public goods","Macro, Welfare & Public Economics",r"public good"),
 ("Zero lower bound","Macro, Welfare & Public Economics",r"zero lower bound"),
 ("Sectoral balances","Macro, Welfare & Public Economics",r"sectoral balance"),
 ("Resource curse","Macro, Welfare & Public Economics",r"resource curse"),
 # Information, behavioral & decision
 ("Utility & preferences","Information, Behavioral & Decision",r"utility function|\bpreferences\b"),
 ("Signaling","Information, Behavioral & Decision",r"\bsignal"),
 ("Screening","Information, Behavioral & Decision",r"\bscreen"),
 ("Discounting / time preference","Information, Behavioral & Decision",r"discount rate|time preference|discounting"),
 ("Revealed preference","Information, Behavioral & Decision",r"revealed preference"),
 ("Moral hazard","Information, Behavioral & Decision",r"moral hazard"),
 ("Adverse selection","Information, Behavioral & Decision",r"adverse selection"),
 ("Asymmetric information","Information, Behavioral & Decision",r"asymmetric information|information asymmetr"),
 ("Risk aversion","Information, Behavioral & Decision",r"risk aver"),
 ("Behavioral economics","Information, Behavioral & Decision",r"behavioral econ"),
 ("Principal-agent","Information, Behavioral & Decision",r"principal[- ]agent"),
 ("Prediction vs. judgment","Information, Behavioral & Decision",r"prediction.{0,15}judg|judg.{0,15}prediction"),
 ("Wireheading","Information, Behavioral & Decision",r"wirehead"),
 # Methods & cross-cutting
 ("Bottlenecks","Methods & Cross-Cutting",r"bottleneck"),
 ("Counterfactual reasoning","Methods & Cross-Cutting",r"counterfactual"),
 ("RCTs / field experiments","Methods & Cross-Cutting",r"\bRCT\b|randomized controlled|field experiment|natural experiment"),
 ("Technology diffusion","Methods & Cross-Cutting",r"diffusion"),
 ("Selection bias","Methods & Cross-Cutting",r"selection bias|selected sample"),
 ("Free disposal","Methods & Cross-Cutting",r"free disposal"),
 ("Coordination / consensus problems","Methods & Cross-Cutting",r"coordination (problem|game)|consensus bottleneck"),
]

# slug -> display title
TITLES = {
 "a-resource-curse-for-ai":"A Resource Curse for AI",
 "ai-and-its-labor-market-effects-in":"AI and Its Labor Market Effects",
 "are-we-there-yet-evaluating-metrs":"Are We There Yet? Evaluating METR",
 "ben-golub-ai-referees-social-learning":"Ben Golub: AI Referees, Social Learning",
 "beyond-task-replacement":"Beyond Task Replacement",
 "can-ai-make-better-decisions-than":"Can AI Make Better Decisions Than Doctors?",
 "can-political-science-contribute":"Can Political Science Contribute?",
 "claude-just-refereed-the-anthropic":"Claude Just Refereed the Anthropic Paper",
 "could-ai-save-us-from-making-hard":"Could AI Save Us From Making Hard Decisions?",
 "did-metas-algorithms-swing-the-2020":"Did Meta's Algorithms Swing the 2020 Election?",
 "does-ai-cheapen-talk-bo-cowgill-pt":"Does AI Cheapen Talk? (Bo Cowgill)",
 "emergency-pod-is-ai-already-causing":"Emergency Pod: Is AI Already Causing Labor Effects?",
 "epistemic-apocalypse-and-prediction":"Epistemic Apocalypse and Prediction Markets",
 "evaluating-gdpval-openais-eval-for":"Evaluating GDPVal",
 "high-prices-higher-welfare-the-auto":"High Prices, Higher Welfare: The Automobile",
 "how-much-should-we-invest-in-ai-safety":"How Much Should We Invest in AI Safety?",
 "if-the-robots-are-coming-why-arent":"If the Robots Are Coming, Why Aren't Interest Rates Higher?",
 "is-social-media-a-trap":"Is Social Media a Trap?",
 "one-llm-to-rule-them-all":"One LLM to Rule Them All",
 "robots-for-the-retired":"Robots for the Retired",
 "scaling-laws-meet-persuasion":"Scaling Laws Meet Persuasion",
 "sci-fi-economics":"Sci-Fi Economics",
 "should-ai-read-without-permission":"Should AI Read Without Permission?",
 "situational-awareness":"Situational Awareness",
 "techno-prophets-try-macroeconomics":"Techno-Prophets Try Macroeconomics",
 "the-best-books-seth-read-in-2025":"The Best Books Seth Read in 2025",
 "the-fruit-fly-of-organizational-decision":"The Fruit Fly of Organizational Decision-Making",
 "the-simple-macroeconomics-of-ai":"The Simple Macroeconomics of AI",
 "what-can-we-learn-from-ai-exposure":"What Can We Learn From AI Exposure?",
 "when-humans-and-machines-dont-say":"When Humans and Machines Don't Say No",
 "will-super-intelligences-opportunity":"Will Superintelligence's Opportunity...",
 "ioana-marinescu-on-insuring-workers":"Ioana Marinescu on Insuring Workers",
 "keven-bryan-on-bottlenecks-ai-in":"Kevin Bryan on Bottlenecks & AI in China",
 "seb-krier-on-agi-the-coasean-singularity":"Seb Krier on AGI & the Coasean Singularity",
 "avi-goldfarb-on-prediction-machines":"Avi Goldfarb on Prediction Machines",
 "weak-links-strong-predictions-kremers":"Weak Links, Strong Predictions (Kremer's O-Ring)",
 "the-most-important-philosophical":"The Most Important Philosophical Treatise",
 "alex-imas-demand-collapse-bargaining":"Alex Imas: Demand Collapse & Bargaining",
 "is-ai-making-books-on-amazon-worse":"Is AI Making Books on Amazon Worse?",
 "noah-smith-on-blogging-ai-economics":"Noah Smith on Blogging & AI Economics",
 "basil-halperin-leading-indicators":"Basil Halperin: Leading Indicators for TAI",
 "can-an-ai-interview-you-better-than":"Can an AI Interview You Better Than a Human?",
 "anecdotes-from-ai-supercharged-science":"Anecdotes from AI Supercharged Science",
}

def load(f):
    t=open(f,encoding='utf-8',errors='ignore').read()
    if f.endswith('.html'): t=re.sub('<[^>]+>',' ',t)
    return html.unescape(t)

files=sorted(glob.glob('transcripts/*.txt')+glob.glob('transcripts/*.html'))
texts={}
for f in files:
    slug=os.path.basename(f).rsplit('.',1)[0]
    if slug=='priors_posteriors_summary': continue
    texts[slug]=load(f)

def title(slug): return TITLES.get(slug, slug.replace('-',' ').title())

# One-line plain-English definition per concept
DEFS = {
 "Task-based framework (Acemoglu-Restrepo)":"Models technology by the specific tasks it automates or creates, rather than treating labor as one undifferentiated input.",
 "Production functions":"A formula mapping inputs like labor and capital into output; the workhorse for thinking about how AI changes production.",
 "Total factor productivity (TFP)":"The portion of output growth not explained by adding more labor or capital — roughly, how cleverly inputs are combined.",
 "Economics of superstars":"Why small differences in talent translate into huge differences in pay when technology lets the best serve a vast market.",
 "CES production function":"A production function with a constant, tunable elasticity of substitution between inputs — a flexible default for AI-vs-labor modeling.",
 "Nested CES":"A CES built from CES sub-bundles, letting some inputs substitute easily while others don't — useful for grouping AI, capital, and labor.",
 "Cobb-Douglas":"The simplest production function, where input shares are fixed and the substitution elasticity equals one.",
 "O-ring theory":"Kremer's idea that when production needs every step done well, weak links are catastrophic and top workers sort together.",
 "Baumol's cost disease":"Sectors with slow productivity growth (care, education) get relatively more expensive as the rest of the economy speeds up.",
 "Capital deepening":"Raising output per worker by giving each worker more capital (machines, compute) rather than by inventing new methods.",
 "Knowledge spillovers":"Ideas generated by one firm or worker raising the productivity of others without full compensation.",
 "Returns to scale":"How output responds when all inputs scale up together — increasing returns can drive explosive growth.",
 "AK / endogenous growth":"Growth models where accumulating capital or ideas sustains permanent growth from within, rather than from outside shocks.",
 "Ideas getting harder to find / fishing out":"The finding that sustaining constant growth takes ever more researchers as the easy discoveries get used up.",
 "Solow growth model":"The classic model where growth ultimately comes from exogenous technological progress, not capital accumulation alone.",
 "Malthusian ceiling":"The pre-industrial trap where productivity gains get eaten by population growth, holding living standards flat.",
 "Skill-biased technical change":"Technology that raises demand for skilled workers more than unskilled, widening wage gaps.",
 "Learning-by-doing":"Productivity improvements that come from accumulated experience in production rather than formal R&D.",
 "Turing Trap":"Brynjolfsson's warning that aiming AI at imitating humans (replacement) rather than augmenting them concentrates wealth and power.",
 "Creative destruction":"Schumpeter's process where new technologies generate growth by destroying incumbent firms and jobs.",
 "Complements vs. substitutes":"Whether two inputs make each other more valuable (complements) or replace each other (substitutes) — central to whether AI helps or displaces workers.",
 "Marginal analysis (cost/product/utility)":"Decision-making based on the value of one more unit — the core optimizing logic of economics.",
 "General equilibrium":"Analysis that traces effects through all interconnected markets at once, not just the one directly hit.",
 "Elasticity":"How responsive one quantity is to a change in another (e.g. demand to price), in percentage terms.",
 "Auctions & procurement":"Mechanisms for allocating goods or contracts via bidding — increasingly relevant as AI agents transact.",
 "Coasean bargaining":"Coase's insight that with low transaction costs, parties can bargain to efficient outcomes regardless of who holds the initial rights.",
 "Bargaining":"How two parties split the gains from a deal, and what determines each side's leverage.",
 "Market power / monopoly":"A seller's ability to profitably raise price above cost because buyers lack good alternatives.",
 "Monopsony":"Buyer-side market power — e.g. employers facing little competition can pay workers below their productivity.",
 "Assortative matching":"The tendency of high-quality partners (workers, firms, mates) to pair with each other rather than mix.",
 "Sorting":"How heterogeneous workers or firms get allocated across jobs, teams, or markets by quality.",
 "Mechanism design":"Engineering the rules of a game so that self-interested participants produce a desired outcome.",
 "Antitrust":"Competition law and policy aimed at curbing market power, collusion, and harmful mergers.",
 "Collusion":"Firms (or AI agents) coordinating to raise prices or restrict output instead of competing.",
 "Property rights":"Who is legally entitled to use, exclude others from, and profit from an asset — including data and AI outputs.",
 "Two-sided markets / platforms":"Markets where a platform connects two distinct groups (e.g. buyers and sellers) whose value depends on each other.",
 "Network effects":"When a product becomes more valuable to each user as more people use it.",
 "Transaction costs":"The frictions of making a deal — searching, negotiating, enforcing — that AI agents might dramatically lower.",
 "Preferential attachment":"A 'rich get richer' process where popularity attracts more popularity, generating skewed outcomes.",
 "Human capital":"The skills, knowledge, and experience embodied in people that make their labor productive.",
 "Automation vs. augmentation":"Whether a technology replaces a worker's task outright or makes the worker more productive at it.",
 "Comparative advantage":"The principle that parties gain by specializing where their relative cost is lowest — even if one is better at everything.",
 "Labor-market matching":"How workers and jobs find each other amid frictions, and how well the resulting pairings fit.",
 "Structural unemployment / skill mismatch":"Joblessness that persists because workers' skills or locations don't match available jobs.",
 "Universal Basic Income (UBI)":"An unconditional cash transfer to all, often proposed as a response to AI-driven job loss.",
 "Elite overproduction":"When a society trains more credentialed aspirants than it has elite positions, breeding instability.",
 "Trade Adjustment Assistance":"US programs (retraining, wage insurance) that compensate workers harmed by trade — a template for AI-adjustment policy.",
 "Wage insurance":"Topping up the pay of displaced workers who take lower-paying new jobs, to ease transitions.",
 "Efficiency wages":"Paying above the market rate to boost worker effort, loyalty, or retention.",
 "GDP & growth":"The total value of goods and services produced, and how fast it expands — the headline gauge of AI's macro impact.",
 "Real interest rates":"Interest rates adjusted for inflation; a market signal of expected future growth and scarcity of capital.",
 "Consumer / social surplus & welfare":"The net benefit people get beyond what they pay — the basic yardstick for whether a change makes society better off.",
 "Inequality":"The dispersion of income, wealth, or power across people — a recurring worry in AI scenarios.",
 "Externalities":"Costs or benefits of an action that fall on third parties and aren't priced in.",
 "Redistribution":"Using taxes and transfers to reshape the distribution of income or wealth.",
 "Saving / dissaving":"Setting aside (or drawing down) income; aggregate saving behavior shapes growth and demand.",
 "Demand collapse / satiation":"The risk that as needs get cheaply met, spending stalls and demand-side problems emerge.",
 "Piketty / r > g":"Piketty's claim that when returns on capital exceed growth, wealth concentrates over time.",
 "Marginal propensity to consume (MPC)":"The share of an extra dollar of income that a person spends rather than saves.",
 "Optimal taxation":"How to design taxes that raise revenue and redistribute with the least distortion to incentives.",
 "Sovereign wealth funds":"State-owned investment funds, sometimes proposed to spread the returns from AI capital broadly.",
 "Industrial policy":"Government efforts to steer the economy toward favored sectors or technologies.",
 "Pigouvian taxes":"Taxes set equal to the external harm of an activity, to make actors internalize the cost.",
 "Georgist / land value tax":"Taxing the unimproved value of land and natural resources — rents that owners did nothing to create.",
 "Public goods":"Goods that are non-rival and non-excludable (e.g. basic research), which markets tend to underprovide.",
 "Zero lower bound":"The constraint that nominal interest rates can't fall much below zero, limiting monetary stimulus.",
 "Sectoral balances":"The accounting identity linking the financial surpluses and deficits of government, private, and foreign sectors.",
 "Resource curse":"The paradox that resource-rich economies often underperform — invoked as a metaphor for AI windfalls.",
 "Utility & preferences":"The formal representation of what people want and how they trade off options.",
 "Signaling":"Taking a costly, observable action (like a degree) to credibly convey hidden quality.",
 "Screening":"The flip side of signaling: the uninformed party designs choices to get others to reveal their type.",
 "Discounting / time preference":"How people value future payoffs less than present ones, and at what rate.",
 "Revealed preference":"Inferring what people truly value from the choices they actually make.",
 "Moral hazard":"When insurance or protection from consequences leads people to take more risk or less care.",
 "Adverse selection":"When hidden information makes the worst risks most likely to participate, unraveling a market.",
 "Asymmetric information":"Situations where one party to a deal knows more than the other.",
 "Risk aversion":"Preferring a sure thing to a gamble of equal expected value.",
 "Behavioral economics":"Economics that incorporates psychological realism about how people actually decide.",
 "Principal-agent":"The problem of getting an agent to act in a principal's interest when their goals and information differ — central to AI alignment-as-economics.",
 "Prediction vs. judgment":"Agrawal-Gans-Goldfarb's split: AI cheapens prediction, raising the value of the human judgment about what to do with it.",
 "Wireheading":"Directly stimulating the reward signal instead of achieving the goal it was meant to track.",
 "Bottlenecks":"The scarce, hard-to-scale steps that cap how much a new technology can raise output.",
 "Counterfactual reasoning":"Asking what would have happened absent the intervention — the basis of causal inference.",
 "RCTs / field experiments":"Randomized trials run in real-world settings to identify causal effects.",
 "Technology diffusion":"The often-slow spread of a new technology across firms and the economy after invention.",
 "Selection bias":"Distorted conclusions from a non-representative sample (e.g. cherry-picked demos).",
 "Free disposal":"The assumption that you can costlessly ignore unwanted output — so more options can't hurt.",
 "Coordination / consensus problems":"Situations where the good outcome requires many actors to align, and no one can move first alone.",
}

# Build category-ordered output
cat_order=["Growth & Production Theory","Microeconomics & Industrial Organization","Labor Economics",
           "Macro, Welfare & Public Economics","Information, Behavioral & Decision","Methods & Cross-Cutting"]
data_concepts=[]
md_sections=OrderedDict((c,[]) for c in cat_order)
SUBSTACK="https://empiricrafting.substack.com/p/"
for name,cat,pat in CONCEPTS:
    rx=re.compile(pat,re.I)
    eps=sorted(
        ({"title":title(slug),"url":SUBSTACK+slug} for slug,txt in texts.items() if rx.search(txt)),
        key=lambda e:e["title"].lower())
    if not eps: continue
    if name not in DEFS: raise SystemExit(f"Missing definition for concept: {name!r}")
    data_concepts.append({"name":name,"definition":DEFS[name],"category":cat,"count":len(eps),"episodes":eps})
    md_sections[cat].append((name,DEFS[name],eps))

# sort within category by count desc then name
data_concepts.sort(key=lambda d:(cat_order.index(d["category"]), -d["count"], d["name"]))

with open('_data/concepts.yml','w') as f:
    f.write("# Economic concepts mentioned across Justified Posteriors episodes\n")
    f.write("# Auto-generated by scanning transcripts/ ; regenerate when new episodes are added.\n")
    f.write(yaml.safe_dump({"concepts":data_concepts}, sort_keys=False, allow_unicode=True, width=1000))

# Markdown mapping
with open('transcripts/economic_concepts.md','w') as f:
    f.write("# Economic Concepts in Justified Posteriors\n\n")
    f.write(f"Concepts mentioned across {len(texts)} episode transcripts, grouped by field. ")
    f.write("Generated by keyword scan of `transcripts/`. Number in parentheses = episodes mentioning it.\n\n")
    for cat in cat_order:
        items=sorted(md_sections[cat], key=lambda x:(-len(x[2]), x[0]))
        if not items: continue
        f.write(f"## {cat}\n\n")
        for name,defn,eps in items:
            f.write(f"### {name} ({len(eps)})\n")
            f.write(f"*{defn}*\n\n")
            for e in eps: f.write(f"- [{e['title']}]({e['url']})\n")
            f.write("\n")

print("Wrote _data/concepts.yml and transcripts/economic_concepts.md")
print("Concepts:",len(data_concepts),"| Episodes scanned:",len(texts))
