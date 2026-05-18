# CLI (Command-Line Interface) Tools and Scripts

## Introduction

Technical repository of scripts and tools to make my life a little better, and maybe yours too. Follow [MIT License](LICENSE) rules and your life can too be like mine (just a little faster than the day before!). Languages used: Node.js, Perl, Python, Bash (and other shells), .Net, and PowerShell. More to come, I'm sure.

## Project Structure

```
./
├── shell/                # --- shell tools ---
│   ├── edit.zsh          # wrapper for cotEditor CLI to open one or multiple files
│   ├── mongod.sh         # starts MongoDB daemon with the config file in `/usr/local/etc/mongod.conf`
│   └── mpull.sh          # does a `git pull rebase` on all active git repository folders under `~/git`
├── dotnet/               # --- .NET tools ---
│   └── HelloWorld/       # a new test .NET application [^requires]
├── git/                  # --- git tools ---
│   └── husky/            # special tool to add versioning to a repo or project
├── node/                 # --- Node.js tools ---
│   ├── ginit/            # creates a new GitHub repository if not already created [^requires]
│   ├── prep-doc/         # converts existing docs or creates new templated MD or MDX documents [^requires]
│   └── ntpcheck/         # validates local machine date/time with the top NTP servers (unfinished) [^requires]
│   └── readme-gen/       # creates a skeleton README.md after reading repo files and folders
├── perl/                 # --- Perl tools --- [^modules]
│   ├── parser/           
│   │   ├── dirParser.pl  # Parses folder structure of given path and returns count of files and folders  
│   ├── Passman/           
│   │   ├── Passman.pm    # Perl module use to perform encryption/decryption of passwords and file
│   │   └── Passman.pl    # script tool to use `Passman.pm` to manage passwords
│   ├── building.pl       # finds the fastest and cheapest algorithms for finding the highest floor that will not break the golf ball dropped from a 100k floor building 
│   └── domains.pl        # checks the availability of DNS Domains (inside code) and exports results to `./businesszones.txt`
├── powershell/
│   └── Passman.ps1       # manages passwords and password file (unfinished)
├── python/
│   ├── gross_pay.py      # calculates and displays gross pay (hours * rate)
│   └── hello.py          # prints "What a Wonderful World" to the screen
└── README.md             # this file!
```

[^requires]: Requires `npm install` or similar installation steps (read instructions inside code files)
[^modules]: Requires installation of modules such as `perl CPAN Perl::LanguageServer` for Perl


## Installation

No installation is necessary for the repository. Each tool is separate and so checking the notes and documentation inside each code file will help you know whether it needs an `npm install` or `perl CPAN Net::DNS::Dig` or something else.

## Languages and Tools Used

- Markdown for this document and others
- Visual Studio Code is now the industry standard IDE, but feel free to let me know if you find something better
- AI chatbots. Started with [Anthropic Claude](https://claude.ai) and [Proton Lumo](https://lumo.proton.me) and [DuckDuckGo Duck](https://duck.ai) and now am also using [GitHub CoPilot Code](https://github.com/copilot)

## Release Notes

### 23 April 2026 | v0.2

> First development version in a very long time. I should have been keeping better track of versioning, but this one is a big release, so I've aptly numbered it 0.2.

#### Important notes, fixes, changes,additives:
- Expanded `README.md` to document all folders/languages used for tools. 
- Added new Node.js tool: `convert-doc/index.js`, which does a few things:  
  + Convert documents (full input list below) from:
```
  odf:  ['.odt', '.ods', '.odp', '.odg', '.odf'],
  txt:  ['.txt'],
  md:   ['.md', '.mdx'],
  docx: ['.docx'],
  rtf:  ['.rtf'],
  html: ['.html', '.htm'],
  rst:  ['.rst'],
```  
  + Convert documents (full output list below) to:
```
  md:   'commonmark',
  mdx:  'commonmark',
  txt:  'plain',
  html: 'html5',
  rst:  'rst',
  docx: 'docx',
  epub: 'epub',
```
  + creates new MD or MDX documents from a simple template and place into correct folder for editing and publishing
- Cleaned up non-starter tool files and folders

#### Known Issues:
- Some tools are yet to be tested. Use at your own risk.
