
insert into public.curriculum_versions(id,level,label,notes) values ('2027-L1',1,'CFA Level I — 2027','Module titles follow the most recent published Level I structure and are flagged as needing verification against official 2027 materials. LOS statements are not reproduced; administrators add verified LOS.');

insert into public.subjects(id,version_id,name,short_name,sort,est_hours) values
('ethics','2027-L1','Ethical and Professional Standards','Ethics',1,30),
('quant','2027-L1','Quantitative Methods','Quant',2,30),
('econ','2027-L1','Economics','Economics',3,25),
('fsa','2027-L1','Financial Statement Analysis','FSA',4,45),
('corp','2027-L1','Corporate Issuers','Corporate',5,20),
('equity','2027-L1','Equity Investments','Equity',6,30),
('fi','2027-L1','Fixed Income','Fixed Income',7,40),
('deriv','2027-L1','Derivatives','Derivatives',8,20),
('alts','2027-L1','Alternative Investments','Alternatives',9,15),
('pm','2027-L1','Portfolio Management','Portfolio',10,20);

with src(sid, titles) as (values
('ethics', array['Ethics and Trust in the Investment Profession','Code of Ethics and Standards of Professional Conduct','Guidance for Standards I–VII','Introduction to the Global Investment Performance Standards (GIPS)','Ethics Application']),
('quant', array['Rates and Returns','Time Value of Money in Finance','Statistical Measures of Asset Returns','Probability Trees and Conditional Expectations','Portfolio Mathematics','Simulation Methods','Estimation and Inference','Hypothesis Testing','Parametric and Non-Parametric Tests of Independence','Simple Linear Regression','Introduction to Big Data Techniques']),
('econ', array['The Firm and Market Structures','Understanding Business Cycles','Fiscal Policy','Monetary Policy','Introduction to Geopolitics','International Trade','Capital Flows and the FX Market','Exchange Rate Calculations']),
('fsa', array['Introduction to Financial Statement Analysis','Analyzing Income Statements','Analyzing Balance Sheets','Analyzing Statements of Cash Flows I','Analyzing Statements of Cash Flows II','Analysis of Inventories','Analysis of Long-Term Assets','Topics in Long-Term Liabilities and Equity','Analysis of Income Taxes','Financial Reporting Quality','Financial Analysis Techniques','Introduction to Financial Statement Modeling']),
('corp', array['Organizational Forms, Corporate Issuer Features, and Ownership','Investors and Other Stakeholders','Corporate Governance: Conflicts, Mechanisms, Risks, and Benefits','Working Capital and Liquidity','Capital Investments and Capital Allocation','Capital Structure','Business Models']),
('equity', array['Market Organization and Structure','Security Market Indexes','Market Efficiency','Overview of Equity Securities','Company Analysis: Past and Present','Industry and Competitive Analysis','Company Analysis: Forecasting','Equity Valuation: Concepts and Basic Tools']),
('fi', array['Fixed-Income Instrument Features','Fixed-Income Cash Flows and Types','Fixed-Income Issuance and Trading','Fixed-Income Markets for Corporate Issuers','Fixed-Income Markets for Government Issuers','Fixed-Income Bond Valuation: Prices and Yields','Yield and Yield Spread Measures for Fixed-Rate Bonds','Yield and Yield Spread Measures for Floating-Rate Instruments','The Term Structure of Interest Rates: Spot, Par, and Forward Curves','Interest Rate Risk and Return','Yield-Based Bond Duration Measures and Properties','Yield-Based Bond Convexity and Portfolio Properties','Curve-Based and Empirical Fixed-Income Risk Measures','Credit Risk','Credit Analysis for Government Issuers','Credit Analysis for Corporate Issuers','Fixed-Income Securitization','Asset-Backed Security (ABS) Instrument and Market Features','Mortgage-Backed Security (MBS) Instrument and Market Features']),
('deriv', array['Derivative Instrument and Derivative Market Features','Forward Commitment and Contingent Claim Features and Instruments','Derivative Benefits, Risks, and Issuer and Investor Uses','Arbitrage, Replication, and the Cost of Carry in Pricing Derivatives','Pricing and Valuation of Forward Contracts and for an Underlying with Varying Maturities','Pricing and Valuation of Futures Contracts','Pricing and Valuation of Interest Rate and Other Swaps','Pricing and Valuation of Options','Option Replication Using Put–Call Parity','Valuing a Derivative Using a One-Period Binomial Model']),
('alts', array['Alternative Investment Features, Methods, and Structures','Alternative Investment Performance and Returns','Investments in Private Capital: Equity and Debt','Real Estate and Infrastructure','Natural Resources','Hedge Funds','Introduction to Digital Assets']),
('pm', array['Portfolio Management: An Overview','Portfolio Risk and Return: Part I','Portfolio Risk and Return: Part II','Basics of Portfolio Planning and Construction','The Behavioral Biases of Individuals','Introduction to Risk Management'])
)
insert into public.modules(id,subject_id,version_id,title,sort)
select sid || '-m' || lpad(t.ord::text, 2, '0'), sid, '2027-L1', t.title, t.ord
from src, unnest(titles) with ordinality as t(title, ord);
