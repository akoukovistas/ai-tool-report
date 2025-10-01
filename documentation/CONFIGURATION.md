# Configuration Guide

This document covers configuration options for the AI Metrics Report tool.

## Name Variations Configuration

### Overview
The name variations system helps match users across different systems (GitHub, Cursor, organizational data) by recognizing common nicknames and name variations.

### Setup

1. **Copy the template file:**
   ```bash
   cp src/config/name-groups.json.template src/config/name-groups.json
   ```

2. **Customize for your organization:**
   Edit `src/config/name-groups.json` to include name variations specific to your team members.

### Configuration Format

The configuration is a simple JSON array where each sub-array contains names that should be considered equivalent:

```json
[
  ["deborah", "debbie", "deb"],
  ["michael", "mike"],
  ["robert", "rob", "bob"],
  ["james", "jim"],
  ["david", "dave"]
]
```

### Rules

- **Case insensitive**: Names are automatically normalized to lowercase
- **Bidirectional**: If "mike" maps to "michael", then "michael" also maps to "mike"
- **Canonical name**: The first name in each group is considered the canonical form
- **Group members**: All names within a group are considered equivalent

### Common Name Variations

Here are some common name variations you might want to add:

```json
[
  ["william", "bill", "billy"],
  ["richard", "rick", "dick"],
  ["elizabeth", "liz", "beth", "betty"],
  ["christopher", "chris"],
  ["matthew", "matt"],
  ["andrew", "andy"],
  ["jennifer", "jen", "jenny"],
  ["katherine", "kate", "kathy", "katie"],
  ["anthony", "tony"],
  ["benjamin", "ben"],
  ["patricia", "pat", "patty"],
  ["charles", "chuck", "charlie"],
  ["thomas", "tom", "tommy"],
  ["daniel", "dan", "danny"],
  ["joseph", "joe", "joey"],
  ["stephanie", "steph"],
  ["nicholas", "nick"],
  ["timothy", "tim"],
  ["gregory", "greg"],
  ["alexander", "alex"],
  ["rebecca", "becky"],
  ["samantha", "sam"],
  ["jonathan", "jon"],
  ["zachary", "zach"],
  ["joshua", "josh"]
]
```

### Usage in Reports

The name variations are automatically used in:
- **User matching** between GitHub and organizational data
- **Report generation** to consolidate user activity
- **Data analysis** to ensure accurate user identification

### Troubleshooting

**Problem**: Users not being matched correctly
**Solution**: Check if their name variations are included in `name-groups.json`

**Problem**: Configuration not loading
**Solution**: Ensure `src/config/name-groups.json` exists and contains valid JSON

**Problem**: Names still not matching
**Solution**: Verify the names match exactly (case doesn't matter, but spelling does)

### Example Usage

```javascript
import { areNameVariations, getCanonicalName } from '../common/name-variations.js';

// Check if names are equivalent
areNameVariations('mike', 'michael'); // true
areNameVariations('bob', 'robert');   // true

// Get canonical form
getCanonicalName('debbie');  // returns 'deborah'
getCanonicalName('mike');    // returns 'michael'
```

### File Location

- **Configuration**: `src/config/name-groups.json` (gitignored, customize per environment)
- **Template**: `src/config/name-groups.json.template` (committed to repo)
- **Utilities**: `src/common/name-variations.js` (code that loads and uses the config)

### Best Practices

1. **Keep it simple**: Only add variations that are actually used in your organization
2. **Test thoroughly**: Run reports after changes to ensure matching works correctly
3. **Document changes**: Note any custom variations added for your team
4. **Regular updates**: Review and update as team members join/leave

## Other Configuration

### Environment Variables

See the main README.md for required environment variables like `GH_TOKEN`, `CURSOR_API_KEY`, etc.

### Data Directory Structure

The tool expects certain directory structures for data storage. These are created automatically but can be customized via environment variables if needed.
