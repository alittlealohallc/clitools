#!/usr/bin/env python3
import os, subprocess

OUT = "./html3"
os.makedirs(OUT, exist_ok=True)

CSS = """<meta charset="utf-8"><style>
  @page { margin: 0.7in; size: letter; }
  body { font-family: Cambria, Georgia, serif; font-size: 10pt; color: #000; line-height: 1.35; margin:0; padding:0; }
  h1 { font-size: 13pt; font-weight: bold; margin: 0 0 2pt 0; }
  h2 { font-size: 10pt; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #000;
       margin: 10pt 0 3pt 0; padding-bottom: 1pt; letter-spacing: 0.05em; }
  .contact { font-size: 9pt; margin: 0 0 8pt 0; }
  .rl { margin: 6pt 0 1pt 0; }
  .rt { font-weight: bold; }
  .rm { font-style: italic; }
  ul { margin: 2pt 0 4pt 0; padding-left: 18pt; }
  li { margin: 1pt 0; }
  p { margin: 4pt 0; }
  .skl { font-weight: bold; }
</style>"""

def wrap(b): return f"<!DOCTYPE html><html><head>{CSS}</head><body>{b}</body></html>"

HDR = """<h1>Kent Schaeffer</h1>
<p class="contact">West Valley City, UT 84120 &nbsp;|&nbsp; (385) 414-2779 &nbsp;|&nbsp; kent@kentknowsme.com &nbsp;|&nbsp; linkedin.com/in/kentmschaeffer &nbsp;|&nbsp; kentknowsme.com</p>"""

def sec(t): return f"<h2>{t}</h2>"

def role(ti, em, dt, lo=""):
    m = em + (f", {dt}" if dt else "") + (f" \u00b7 {lo}" if lo else "")
    return f'<p class="rl"><span class="rt">{ti}</span> \u2014 <span class="rm">{m}</span></p>'

def ul(*items): return "<ul>" + "".join(f"<li>{i}</li>" for i in items) + "</ul>"
def sk(l, v): return f'<p><span class="skl">{l}:</span> {v}</p>'

def cl_shell(role_title, req_id, dept, body_paras):
    today = "May 11, 2026"
    paras = "".join(f"<p>{p}</p>" for p in body_paras)
    return wrap(HDR + f"""
<p>{today}</p>
<p>Re: {role_title} &mdash; Requisition {req_id}<br>{dept}</p>
<p>Dear Hiring Team,</p>
{paras}
<p>My connection to the University goes beyond a job posting. My partner has served as an associate director here for over 15 years, our stepchildren have studied here, and their son is finishing his PhD this year. I recently interviewed for another technical role on campus and came away more convinced than ever that this is where I want to contribute.</p>
<p>I'd welcome the chance to talk. Thank you for your consideration.</p>
<p>Sincerely,<br>Kent Schaeffer</p>
""")


# ══════════════════════════════════════════════════════════════════
# 1. IT SPECIALIST (PRN44911B)
# ══════════════════════════════════════════════════════════════════

it_resume = wrap(HDR +

sec("Summary") +
"<p>IT generalist with 25+ years of enterprise and client-facing experience spanning software licensing, web content management, technical documentation, and hands-on troubleshooting across macOS and Windows environments. Known for translating complex vendor licensing terms into plain-language guidance, building clear support documentation, and working independently to keep systems, content, and processes accurate and current. Comfortable advising faculty, students, and staff with patience and precision.</p>" +

sec("Core Competencies") +
ul(
    "Software licensing administration, terms, and compliance",
    "Web content management (CMS, HTML/CSS, Confluence, SharePoint)",
    "Technical troubleshooting — macOS (since Apple II) and Windows (since MS-DOS/3.1)",
    "Customer communication and advisory — faculty, students, and staff",
    "Policy, procedure, and compliance documentation",
    "Vendor coordination and software procurement support",
    "Microsoft 365 and Google Workspace administration",
    "Agile/Scrum team participation and process improvement"
) +

sec("Relevant Experience") +

role("Founder and Primary Engineer (Part-Time)", "A Little Aloha LLC", "Mar 2026–Present", "West Valley City, UT") +
ul(
    "Manages software licensing, vendor accounts, and tool subscriptions for a small IT services business — including obtaining install files and license keys, tracking terms and renewal windows, and advising clients on appropriate licensing tiers.",
    "Maintains business website and client-facing content using HTML/CSS and CMS tooling; manages all customer communications independently.",
    "Applies NIST-aligned security and compliance practices in client engagements."
) +

role("IT Service Desk Technician I", "Western Governors University", "Jul–Sep 2025", "Millcreek, UT") +
ul(
    "Advised students, faculty, and staff on software access, installation issues, and licensing questions across macOS and Windows environments.",
    "Resolved technical support tickets efficiently while maintaining clear, professional written and verbal communication.",
    "Contributed to support documentation and process improvements in collaboration with team members."
) +

role("Digital Literacy Instructor", "English Skills Learning Center / LDS Humanitarian Center", "Jan–Sep 2024", "West Valley City, UT") +
ul(
    "Advised 120+ adult learners daily on software use, computer operation, and technology policy — translating technical concepts into accessible language for non-technical audiences.",
    "Planned, installed, and configured two computer labs (30+ laptops each), including obtaining and managing all required software.",
    "Maintained curriculum and equipment documentation; ensured compliance with center policies and procedures."
) +

role("Contract Principal Systems Analyst", "Eliassen Group at Fidelity Investments", "Jun–Sep 2023", "Salt Lake City, UT") +
ul(
    "Authored integration guides and user-facing documentation for a Camunda BPM platform rollout used by non-technical business units.",
    "Coordinated with cross-functional teams to ensure documentation accuracy; participated in team decisions on content structure and process design."
) +

role("Information Security Engineer", "Wells Fargo Bank", "Mar 2018–Dec 2020", "Remote") +
ul(
    "Managed software licensing and procurement for the Anomaly Behavior Project — obtaining install files, license keys, and coordinating with vendors for MySQL, PostgreSQL, Cloudera, and Trifacta.",
    "Maintained extensive technical documentation using Confluence, SharePoint, and CMS platforms; set standards adopted across multiple teams.",
    "Participated in Agile/Scrum ceremonies as Scrum Master, facilitating team decisions on process and tooling improvements."
) +

role("Senior Internet Systems Specialist", "Avnet", "Jan 2000–May 2002", "Chandler, AZ") +
ul(
    "Co-created company-wide software licensing processes and forms for new hires, terminations, and software distribution — including maintaining the Microsoft Select CD collection for licensing and loaning.",
    "Managed and updated website content for new marketing and technology campaigns using HTML/ASP/JavaScript.",
    "Advised staff on software licensing policies and procedures to ensure awareness and compliance across the enterprise.",
    "Maintained software licensing for 500+ servers hosting enterprise services including Avaya, SkillSoft, Aspen, and Concur."
) +

role("Application Development Analyst", "Perot Systems at Catholic Healthcare West", "Jun 2005–Feb 2007", "Phoenix, AZ") +
ul(
    "Maintained Stellent Content and Document Management, FastSearch, and WebTrends applications on Windows Server — managing software updates and licensing for internet-facing systems.",
    "Reviewed, added, and updated configuration, process workflow, and policy documentation for all supported applications.",
    "Consolidated management of Internet domains for CHW, coordinating with colleagues to transfer ownership and maintain licensing records."
) +

sec("Technical Skills") +
sk("Operating Systems", "macOS (Apple II through current), Windows (MS-DOS, 3.1 through current), Linux/Ubuntu (basic)") +
sk("Productivity", "Microsoft 365 (Outlook, Word, Excel, PowerPoint, Visio), Google Workspace, LibreOffice, Adobe Creative Suite") +
sk("Web and CMS", "HTML/CSS/JS, Confluence, SharePoint, Dreamweaver, common CMS platforms") +
sk("Ticketing", "ServiceNow, Remedy, Jira") +
sk("Remote Tools", "RDP, VNC, SSH, LogMeIn Rescue, WebEx") +
sk("Scripting (basic)", "Bash, Python") +

sec("Education and Certifications") +
role("B.S., Computer Science and Information Systems", "Brigham Young University\u2013Hawaii", "1996") +
"<p style='margin-left:18pt;font-style:italic;'>Minor: Business Administration</p>" +
ul(
    "A+ Core 1 \u2014 CompTIA (Oct 2025, Core 2 in progress)",
    "AWS Certified Cloud Practitioner \u2014 Amazon Web Services (2021)",
    "Network+ \u2014 CompTIA (2005)",
    "JavaScript Algorithms and Data Structures \u2014 freeCodeCamp (2024)",
    "Scrum Fundamentals Certified \u2014 ScrumStudy (2020)"
))

it_cl = cl_shell(
    "Information Technology Specialist", "PRN44911B",
    "UIT Office of Software Licensing, University of Utah",
    [
        "I'm applying for the IT Specialist position with the Office of Software Licensing because it maps directly to work I've been doing throughout my career: administering software licensing, managing web content, writing plain-language documentation, and advising people who need accurate answers about what they can and can't do with software.",
        "At Avnet I co-created the company-wide software licensing process — forms, distribution procedures, and the Microsoft Select CD library used across the enterprise. At Wells Fargo I managed licensing and procurement for a multi-platform data project, coordinating with vendors to obtain install files and keys for MySQL, PostgreSQL, Cloudera, and Trifacta. At A Little Aloha LLC I do this daily for clients: tracking terms and renewals, advising on appropriate licensing tiers, and making sure nothing lapses. I understand the difference between a site license and a named-user license, and I know how to explain that difference to someone who just wants to install the software.",
        "On the web content and documentation side: I've maintained CMS-based websites at Avnet, Wells Fargo, and through my own business using HTML/CSS and Confluence. At Fidelity I authored integration guides for non-technical business units. At WGU and the English Skills Learning Center I advised students and faculty on software and technology policy daily — often across language and background differences that required real clarity, not jargon.",
        "I've used macOS since the Apple II days and Windows since MS-DOS. I know both environments at a level of depth that makes troubleshooting instinctive rather than procedural. I'm also comfortable in Microsoft 365, Google Workspace, and the full Adobe Creative Suite, and I have real experience with ticketing systems including ServiceNow, Remedy, and Jira.",
    ]
)


# ══════════════════════════════════════════════════════════════════
# 2. NETWORK ENGINEER I (PRN44877B)
# ══════════════════════════════════════════════════════════════════

net_resume = wrap(HDR +

sec("Summary") +
"<p>Network and DDI infrastructure engineer with 25+ years of experience spanning enterprise-scale DNS/DHCP/IPAM, physical cabling and data center operations, host-side networking, and scripting-based automation. Hands-on background in low-voltage and fiber cabling, IDF/MDF work, network device configuration, and documentation — built from early apprenticeship through a career in financial services and technology. Deep Infoblox and BIND expertise with a strong track record of automation, clear documentation, and cross-team collaboration.</p>" +

sec("Core Competencies") +
ul(
    "DDI infrastructure: DNS, DHCP, IPAM (Infoblox, BIND, QIP)",
    "Physical cabling: fiber, Cat5/5e/6, coax (RG59/60), termination, IDF/MDF, patch panel management",
    "Data center operations: racking, cabling, hardware installation, inventory documentation",
    "LAN/WAN/VPN/DMZ/proxy network fundamentals and configuration",
    "Host-side networking and driver configuration (Linux and Windows)",
    "Network automation and scripting (Perl, Bash, PowerShell, REST API)",
    "Network monitoring: Grafana, Telegraf, SNMP, BMC Network Automation",
    "Network documentation and diagram design (Visio, OmniGraffle)"
) +

sec("Hands-On Cabling and Data Center Experience") +

role("Apprentice Electrician", "Shaffer Electric", "1985–1989", "Salinas, CA") +
ul(
    "Trained in low-voltage and line-voltage electrical work; developed foundational understanding of structured cabling, conduit, and termination practices that carried through a career in IT infrastructure."
) +

role("Student Programmer / IT Support", "Brigham Young University\u2013Hawaii", "1994–1996", "Laie, HI") +
ul(
    "Installed and upgraded Cat5 cabling for the entire first floor of the library; trained in Cat5 termination and installation standards.",
    "Supported MAC/PC workstations, Novell servers, and network infrastructure for library and academic computing staff."
) +

role("IT Manager", "Starwood Hotels \u2014 St. Regis and Century Plaza", "May 2003–Jul 2004", "Los Angeles, CA") +
ul(
    "Managed and maintained server, client, and network infrastructure for a large convention and luxury hotel — 300+ staff, 1,100 guest rooms, 100k sq ft of convention space.",
    "Monitored and secured multiple separate convention and hotel networks and Internet connections.",
    "Led full desktop/laptop refresh projects and trained contractors and staff to complete infrastructure projects."
) +

role("Senior Internet Systems Specialist", "Avnet", "Jan 2000–May 2002", "Chandler, AZ") +
ul(
    "Installed, secured, and managed 500+ Windows NT/2000 servers and network appliances (F5 BigIP load balancers) in an enterprise DMZ environment.",
    "Administered company-wide DNS zones, records, and IP address assignments; maintained BIND 4.9 on HP-UX and began BIND 9.2 upgrade on Solaris.",
    "Implemented new office and distribution center LANs in Hong Kong (ARISE Project) — one file server, 70+ NT workstations, networked printers — and documented the installation standard for Asia offices.",
    "Designed, diagrammed, and documented server configurations, network topology, and operational processes.",
    "Consulted on enterprise Active Directory, VPN, and CBT server projects."
) +

role("Contract Operations Analyst", "TekSystems at Charles Schwab", "Jun 2007–Jun 2008", "Phoenix, AZ") +
ul(
    "Made load balancer configuration changes using Cisco HSE and GSS technologies.",
    "Provided first-level network and application support across Windows, Linux, and Solaris systems; scheduled break/fix outage events and authored RCA reports."
) +

role("DDI Automation and Network Engineer", "Wells Fargo Bank", "Aug 2008–Jul 2015", "Remote") +
ul(
    "Designed and maintained network and DDI documentation including process diagrams, network diagrams, and operational runbooks — pioneering the first combined WF/Wachovia merger documentation set.",
    "Managed DNS domain and record changes for high-priority enterprise projects; administered VitalQIP and Infoblox IPAM across the full merged enterprise environment.",
    "Built Korn Shell automation on Linux for DDI import processing, validation, and change management; reduced manual effort and error rate significantly.",
    "Worked directly with marketing, management, and vendors to translate business requirements into DNS/domain configurations and technical documentation."
) +

role("DDI Automation Engineer and Technical Team Lead", "Wells Fargo Bank", "Jul 2015–Mar 2018", "Remote") +
ul(
    "Migrated DDI provisioning from vendor proprietary Perl libraries to open-source REST API against Infoblox IPAM — improving reliability and auditability of host-side network record management.",
    "Built and maintained automation processing 1,000–10,000 nightly DDI object changes; improved accuracy 30%+.",
    "Managed DNS and email security records (SPF, DKIM, DMARC) for high-visibility marketing campaigns, working directly with marketing professionals and vendors.",
    "Promoted to Technical Team Lead; led technical training sessions and earned two Wells Fargo Gold Coin awards."
) +

role("Contract Senior Automation Engineer", "Randstad at Consolidated Edison", "Dec 2022–Mar 2023", "Remote") +
ul(
    "Developed PowerShell, HTML, XML, and BMC Network Automation scripts to automate configuration changes across all corporate network devices before or during security incidents.",
    "Revamped network monitoring dashboards and UI services; maintained all changes in source control with clear documentation."
) +

role("DDI Infrastructure Engineer", "Goldman Sachs", "Jun–Dec 2021", "Salt Lake City, UT") +
ul(
    "Led build-out of a global DDI Level 2 support team; modernized infrastructure processes for DNS, DHCP, IPAM, and NTP at enterprise scale.",
    "Mentored engineers on Linux, GitHub, and security engineering practices."
) +

sec("Technical Skills") +
sk("DDI", "Infoblox (IPAM, DNS, DHCP — REST API + UI), VitalQIP/QIP, ISC BIND 4.9\u20139.x, SPF/DKIM/DMARC") +
sk("Cabling and Physical", "Fiber, Cat5/5e/6, coax (RG59/60), termination, IDF/MDF, patch panels, rack installation") +
sk("Networking", "LAN, WAN, VPN, DMZ, proxy, CAN; TCP/IP, IPv4, IPv6; F5 BigIP, Cisco HSE/GSS; SNMP") +
sk("Automation and Scripting", "Perl, Bash/Korn shell, PowerShell, Python (basic), REST API, XML") +
sk("Systems", "Linux (RHEL, CentOS, Ubuntu, HP-UX, AIX, SuSE), Windows Server") +
sk("Monitoring", "Grafana, Telegraf, BMC Network Automation, Nagios (basic)") +
sk("Documentation", "Visio, OmniGraffle, Confluence, SharePoint — network diagrams and runbooks") +
sk("Version Control", "Git/GitHub") +

sec("Education and Certifications") +
role("B.S., Computer Science and Information Systems", "Brigham Young University\u2013Hawaii", "1996") +
"<p style='margin-left:18pt;font-style:italic;'>Minor: Business Administration</p>" +
ul(
    "Network+ \u2014 CompTIA (2005)  |  IPv6 Enthusiast \u2014 Hurricane Electric (2025)",
    "AWS Certified Cloud Practitioner (2021)  |  A+ Core 1 \u2014 CompTIA (2025)",
    "Speaking: 'DDI Basics' \u2014 OpenWest Conference 2018"
))

net_cl = cl_shell(
    "Network Engineer I", "PRN44877B",
    "CHPC \u2014 Center for High Performance Computing, University of Utah",
    [
        "I'm applying for the Network Engineer I role at CHPC because DNS, DHCP, and IPAM infrastructure have been the core of my career for 15+ years — and because my hands-on cabling and data center background goes back further than most people's networking careers.",
        "I learned low-voltage cabling as an apprentice electrician at Shaffer Electric in the mid-1980s, installed Cat5 cabling for an entire library floor at BYU-Hawaii in the mid-1990s, and have been racking, cabling, and terminating in data center and IDF environments ever since — through Avnet, Starwood, Schwab, and multiple remote infrastructure roles. I know the physical layer, not just the logical one.",
        "On the DDI and automation side: I spent over a decade at Wells Fargo managing enterprise DDI infrastructure at scale — Infoblox IPAM, ISC BIND, VitalQIP — writing Perl and Bash automation that processed up to 10,000 nightly record changes with 30%+ accuracy improvements, and handling DNS and email security record changes for high-visibility campaigns that had to be right the first time. I built and maintained the first combined WF/Wachovia merger network documentation and diagrams. At Goldman Sachs I built a global DDI Level 2 team from scratch. At Consolidated Edison I automated network device configuration changes across the entire corporate network device portfolio.",
        "I'll be direct about my gaps: I haven't administered Infiniband or RoCE fabrics directly. But I understand TCP/IP deeply, my physical cabling background is broad, and I have the documentation discipline and automation mindset to contribute from day one while building out HPC-specific knowledge. CHPC's cross-training culture is exactly the environment where I work best.",
    ]
)


# ══════════════════════════════════════════════════════════════════
# 3. RESEARCH ENABLEMENT ENGINEER (PRN44832B)
# ══════════════════════════════════════════════════════════════════

ree_resume = wrap(HDR +

sec("Summary") +
"<p>Systems engineer, automation developer, and technical writer with 25+ years of experience building internal tools, automating infrastructure workflows, and bridging the gap between technical operations and end users. Deep background in Linux administration, scripting-based CI/CD pipelines, secrets management, container technologies, documentation systems, and security compliance work (HIPAA, NIST 800-171). Practical experience with AI/LLM tooling including local model deployment, API integration, and security-focused evaluation. Experienced working at the intersection of systems, security, and user services across on-premises, cloud, hybrid, and regulated environments.</p>" +

sec("Core Competencies") +
ul(
    "Internal tooling and workflow automation design",
    "CI/CD pipelines and build automation (Ansible, Docker, GitHub, Artifactory)",
    "Secrets management (HashiCorp Vault, CyberArk, custom Perl-based solutions)",
    "Linux administration — RHEL, CentOS, Ubuntu, AIX, HP-UX (most of career)",
    "Container technologies: Docker (production), Podman/Apptainer (familiarity)",
    "Security compliance: HIPAA hands-on, NIST 800-171 adjacent work",
    "Vulnerability scanning, patch management, and lifecycle tracking",
    "AI/LLM tooling: local model deployment (Ironclaw/Llama), API integration (Claude, GPT, GitHub Copilot)",
    "Documentation systems and process design (Confluence, SharePoint, Markdown, Visio)",
    "Cross-functional collaboration — built career on connecting operations, development, and user-facing teams"
) +

sec("Relevant Experience") +

role("Founder and Primary Engineer (Part-Time)", "A Little Aloha LLC", "Mar 2026–Present", "West Valley City, UT") +
ul(
    "Designs and maintains internal tooling, automation workflows, and security-aligned processes for a small IT services business.",
    "Applies NIST-aligned security standards to client engagements; manages vulnerability and patch tracking for client systems.",
    "Actively developing with AI/LLM APIs (Claude, GPT) and local model deployment (Ironclaw/Llama via Ollama) to evaluate integration patterns for internal tooling and workflow automation.",
    "Maintains all documentation, runbooks, and process design artifacts using Markdown, Confluence, and standard office tooling."
) +

role("Information Security Engineer", "Wells Fargo Bank", "Mar 2018–Dec 2020", "Remote") +
ul(
    "Co-architected the technical configuration and RBAC security access model for the Anomaly Behavior Project — integrating MySQL, PostgreSQL, Cloudera Data Platform, and Trifacta into a compliant, governed data environment.",
    "Managed build pipelines and code deployments using Ansible, Docker, and shell scripts for Node.js applications on RHEL; integrated Artifactory into the build and artifact management workflow.",
    "Implemented and maintained HashiCorp Vault and CyberArk for secrets management across application and infrastructure environments.",
    "Maintained NIST 800-171-aligned security standards; managed system upgrades, vulnerability patching, and lifecycle tracking.",
    "Set technology standards and baselines for monitoring (Grafana/Telegraf), application release deployment, and infrastructure including F5 load balancing.",
    "Organized and maintained extensive technical documentation across Confluence, SharePoint, and CMS platforms — documentation was part of done on every project."
) +

role("DDI Automation Engineer and Technical Team Lead", "Wells Fargo Bank", "Jul 2015–Mar 2018", "Remote") +
ul(
    "Built and maintained internal automation tools in Perl, Bash, and HTML to streamline high-volume DDI operational workflows — reducing errors and security risk by 30%+.",
    "Migrated from vendor proprietary automation to open-source REST API integration against Infoblox IPAM; established standard project patterns, testing practices, and runbooks adopted team-wide.",
    "Deployed automation via Git-based source control workflows; maintained all runbooks and architecture notes alongside code changes.",
    "Trained team members on updated tooling and security practices; established best practices for automation development across the group."
) +

role("Senior Software Engineer", "Five9 Inc", "Jan–Sep 2022", "Remote") +
ul(
    "Reverse-engineered existing VM server configurations to provision new Google Cloud environments (CentOS/PostgreSQL/Apache/MySQL) from scratch following security best practices.",
    "Built Perl/SQL automation for data feed and reporting processes; deployed via GitHub repositories to pooled servers.",
    "Documented all processes, configurations, and engineer notes in Confluence and SharePoint."
) +

role("Contract Senior Automation Engineer", "Randstad at Consolidated Edison", "Dec 2022–Mar 2023", "Remote") +
ul(
    "Delivered end-to-end automation for network device killswitch actions — scoped, built, tested, documented, and wired into existing monitoring and ticketing fabric.",
    "All changes maintained in source control with clear commit messages explaining rationale; runbooks delivered alongside code."
) +

role("Contract Principal Systems Analyst", "Eliassen Group at Fidelity Investments", "Jun–Sep 2023", "Salt Lake City, UT") +
ul(
    "Led design and implementation of integration guides for business units migrating to a Camunda-based BPM platform.",
    "Translated complex system behavior into structured, maintainable documentation accessible to non-technical users.",
    "Focused on sustainable documentation design and developer experience — guides were built to remain accurate as the platform evolved."
) +

role("Application Development Analyst", "Perot Systems at Catholic Healthcare West", "Jun 2005–Feb 2007", "Phoenix, AZ") +
ul(
    "Supported HIPAA-regulated application environments — IBM WebSphere Application Server, WebSphere Portal, Stellent Content Management — on SuSE Linux and Windows Server.",
    "Managed application updates, security patches, and configuration changes in compliance with HIPAA requirements.",
    "Maintained process workflow and policy documentation for all supported applications; consolidated domain management and internet presence for CHW facilities."
) +

role("Security Administrator", "Imperium Staffing at Perot Systems / Catholic Healthcare West", "2004–2005", "Phoenix, AZ") +
ul(
    "Provided enterprise security administration for a large HIPAA-covered healthcare provider spanning three western states.",
    "Managed second-level security request and incident queue using Remedy; created, changed, and removed user-level access in Active Directory, Exchange, and proprietary applications on AS/400, Unix, and Windows."
) +

sec("Technical Skills") +
sk("Languages and Scripting", "Perl, Bash/Korn shell, Python (basic), PowerShell, JavaScript, XML, HTML") +
sk("CI/CD and Build", "Ansible, Docker, GitHub, Artifactory, shell-based deployment pipelines") +
sk("Secrets Management", "HashiCorp Vault, CyberArk, custom Perl-based secrets tooling") +
sk("Containers", "Docker (production deployments), Podman/Apptainer (familiarity)") +
sk("Linux/Unix", "RHEL, CentOS, Ubuntu, AIX, HP-UX, SuSE \u2014 full administration lifecycle") +
sk("Cloud and Hybrid", "Google Cloud, AWS (CCP certified), on-premises, hybrid; migration and integration experience") +
sk("AI/LLM", "Local model deployment (Ironclaw/Llama via Ollama), API integration (Claude, GPT, GitHub Copilot), security-focused evaluation") +
sk("Security and Compliance", "HIPAA (hands-on), NIST 800-171 (adjacent), RBAC design, vulnerability patching, patch lifecycle tracking") +
sk("Documentation", "Confluence, SharePoint, Markdown, Visio, OmniGraffle, MS Office, Adobe Creative Suite") +
sk("Databases", "PostgreSQL, MySQL, MariaDB, Oracle (basic)") +
sk("Monitoring", "Grafana, Telegraf, Nagios (basic)") +

sec("Education and Certifications") +
role("B.S., Computer Science and Information Systems", "Brigham Young University\u2013Hawaii", "1996") +
"<p style='margin-left:18pt;font-style:italic;'>Minor: Business Administration</p>" +
ul(
    "AWS Certified Cloud Practitioner (2021)  |  A+ Core 1 \u2014 CompTIA (2025, Core 2 in progress)",
    "Scrum Fundamentals Certified \u2014 ScrumStudy (2020)  |  Network+ \u2014 CompTIA (2005)",
    "JavaScript Algorithms and Data Structures \u2014 freeCodeCamp (2024)"
))

ree_cl = cl_shell(
    "Research Enablement Engineer", "PRN44832B",
    "CHPC \u2014 Center for High Performance Computing, University of Utah",
    [
        "I'm applying for the Research Enablement Engineer position because it describes the kind of work I've been doing across most of my career: building the internal tooling, automation, and documentation infrastructure that lets technical teams operate consistently — particularly in environments where compliance requirements add operational complexity rather than reduce it.",
        "The compliance angle is not theoretical for me. At Catholic Healthcare West I worked directly in a HIPAA-regulated environment — supporting application infrastructure under HIPAA requirements, managing security access across AS/400, Unix, and Windows platforms, and maintaining the process documentation that kept the environment auditable. At Wells Fargo I co-architected a NIST 800-171-aligned data environment for the Anomaly Behavior Project, designed its RBAC access model, managed secrets using HashiCorp Vault and CyberArk, and integrated Artifactory into the build pipeline alongside Ansible and Docker deployments for a Node.js stack on RHEL. I've done vulnerability patching and lifecycle tracking in production environments, and I understand the difference between being the security specialist and ensuring the tooling supports the security team's work — the latter is exactly what this role calls for.",
        "On automation and tooling: I've built internal tools that eliminate operational toil across most of my career — Perl and Bash pipelines at Wells Fargo that processed 10,000 nightly changes with 30%+ accuracy improvement, end-to-end network device automation at Consolidated Edison, custom data feed and reporting automation at Five9 deployed via GitHub, and workflow tooling at Fidelity that had to be accurate enough for non-technical business units to use without hand-holding. Documentation has been part of done for me on every project — Confluence, SharePoint, Markdown, Visio, runbooks alongside code.",
        "On the AI/LLM angle: I've been working with Claude, GPT, and GitHub Copilot APIs in my own projects, and I've deployed Ironclaw (a Llama-based model) locally via Ollama to evaluate on-premises LLM integration patterns for internal tooling — specifically looking at where local inference makes sense for security-sensitive environments. This isn't theoretical interest; it's practical exploration of the exact integration patterns your preferred qualifications describe.",
    ]
)


# ══════════════════════════════════════════════════════════════════
# WRITE AND CONVERT
# ══════════════════════════════════════════════════════════════════

files = {
    "IT_Specialist_Resume_v2": it_resume,
    "IT_Specialist_Cover_Letter_v2": it_cl,
    "Network_Engineer_Resume_v2": net_resume,
    "Network_Engineer_Cover_Letter_v2": net_cl,
    "Research_Enablement_Engineer_Resume_v2": ree_resume,
    "Research_Enablement_Engineer_Cover_Letter_v2": ree_cl,
}

for name, content in files.items():
    path = f"{OUT}/{name}.html"
    with open(path, "w") as f:
        f.write(content)
    print(f"  wrote {path}")

print("HTML done. Converting to ODT...")

for name in files:
    src = f"{OUT}/{name}.html"
    result = subprocess.run(
        ["soffice", "--headless", "--convert-to", "odt", src, "--outdir", "/mnt/user-data/outputs/"],
        capture_output=True, text=True
    )
    if result.returncode == 0:
        print(f"  converted {name}.odt")
    else:
        print(f"  ERROR on {name}: {result.stderr[:200]}")

print("Done.")