# Nasty cases

Literal specials: \$100, braces \{x\}, angle \<tag\>, brackets \[y\].

Unknown html <b>stays literal</b> as text.

An inline image ![icon](assets/icon.png) mid-sentence stays literal.

Table: a paragraph starting with the word Table: but not after a table.

```text
fenced code with ``` inside is fine
and $math$ stays raw here
```

![Figure caption with $\sigma$ math and a comment <span data-comment-id="c_fig">note</span>](assets/mix.png){#fig:mix}
