package com.signal.ingestion.pipeline;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.nio.charset.Charset;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The three defects the extractor exists for: hardcoded UTF-8, "the <article> or the
 * whole body" (which on a portal homepage means the navigation menu), and no way to
 * find the articles a listing page links to.
 */
class ArticleExtractorTest {

    private final ArticleExtractor extractor = new ArticleExtractor();

    @Test
    @DisplayName("charset: the HTTP header wins")
    void headerCharsetWins() {
        byte[] gbk = "中文".getBytes(Charset.forName("GBK"));
        String decoded = extractor.decode(gbk, "text/html; charset=gbk");
        assertEquals("中文", decoded);
    }

    @Test
    @DisplayName("charset: an in-document declaration is honoured")
    void metaCharsetIsHonoured() {
        byte[] gbk = ("<meta charset=\"gbk\"><p>中文</p>").getBytes(Charset.forName("GBK"));
        assertEquals("中文", extractor.extract(gbk, "text/html", "https://x.cn/a").text());
    }

    @Test
    @DisplayName("charset: an undeclared one falls back to UTF-8 without throwing")
    void undeclaredCharsetFallsBack() {
        byte[] utf8 = "<p>中文</p>".getBytes(Charset.forName("GBK"));
        assertDoesNotThrow(() -> extractor.extract(utf8, null, "https://x.cn/a"));
        assertNotNull(extractor.extract("<p>中文</p>".getBytes(), null, "https://x.cn/a").text());
    }

    @Test
    @DisplayName("extraction: the article container wins over the page body")
    void prefersTheArticleContainer() {
        String html = """
                <html><head><title>标题</title></head><body>
                <nav>导航 首页 学校概况 机构设置 师资队伍 人才培养 科学研究</nav>
                <div class="footer">版权所有 郑州轻工业大学</div>
                <article>
                  <h1>正文标题</h1>
                  <p>这是一段足够长的正文，用来证明抽取器选择了 article 容器，而不是把站点菜单和版权栏一起算进来。
                  这句话故意写得长一些，让字数超过容器择优的门槛。</p>
                </article>
                </body></html>
                """;
        ArticleExtractor.Article a = extractor.extract(html.getBytes(), "text/html", "https://x.cn/a");
        assertTrue(a.text().contains("这是一段足够长的正文"));
        assertFalse(a.text().contains("学校概况"), "navigation must not be the content: " + a.text());
        assertFalse(a.text().contains("版权所有"), "footer must not be the content: " + a.text());
        assertEquals("标题", a.title());
    }

    @Test
    @DisplayName("extraction: without an <article>, nav/header/footer are stripped")
    void stripsNavigationFromTheBody() {
        String html = """
                <html><head><title>首页</title></head><body>
                <header><nav>首页 学校概况 机构设置 人才招聘</nav></header>
                <main>综合要闻 许昌职业技术学院来校调研交流</main>
                <footer>版权所有 郑州轻工业大学 豫ICP备00000000号</footer>
                </body></html>
                """;
        String text = extractor.extract(html.getBytes(), "text/html", "https://x.cn/a").text();
        assertTrue(text.contains("综合要闻"));
        assertFalse(text.contains("学校概况"), "nav leaked: " + text);
        assertFalse(text.contains("豫ICP备"), "footer leaked: " + text);
    }

    @Test
    @DisplayName("extraction: whitespace is collapsed so nav text cannot pad the content")
    void collapsesWhitespace() {
        String html = "<html><head><title>t</title></head><body><article><p>一    段\n\n正文</p></article></body></html>";
        // whitespace COLLAPSES to one space; it is not deleted, so CJK keeps a gap
        assertEquals("一 段 正文", extractor.extract(html.getBytes(), "text/html", "https://x.cn/a").text());
    }

    @Test
    @DisplayName("extraction: an og:title stands in when <title> is blank")
    void fallsBackToOgTitle() {
        String html = "<html><head><title>  </title>"
                + "<meta property=\"og:title\" content=\"来自 OG 的标题\"></head>"
                + "<body><article><p>正文内容，长度足够通过择优门槛，否则会被当成空内容丢弃。继续保持写一些字。</p></article></body></html>";
        assertEquals("来自 OG 的标题", extractor.extract(html.getBytes(), "text/html", "https://x.cn/a").title());
    }

    @Test
    @DisplayName("links: date-shaped article paths are harvested, nav links are not")
    void harvestsArticleLinksAndSkipsNavigation() {
        String html = """
                <html><body>
                <nav><a href="/159/list.htm">学校概况</a><a href="/161/list.htm">机构设置</a></nav>
                <a href="/index.htm">回到首页</a><a href="/default.htm">默认栏目</a>
                <ul>
                  <li><a href="/2026/1016/c22481a361564/page.htm" title="许昌职业技术学院来校调研交流">许昌职业技术学院来校调研交流</a></li>
                  <li><a href="/2026/1014/c22481a361391/page.htm">学校召开东风校区综合协调联席会</a></li>
                  <li><a href="javascript:void(0)">空链接</a></li>
                  <li><a href="/assets/style.css">样式</a></li>
                </ul>
                </body></html>
                """;
        List<String> links = extractor.articleLinks(
                org.jsoup.Jsoup.parse(html, "https://www.zzuli.edu.cn/"),
                URI.create("https://www.zzuli.edu.cn/"), 10);

        // /159/list.htm and /161/list.htm are channel pages, not articles — a crawl of
        // the navigation is not content, and list/index filenames are the tell.
        assertEquals(List.of(
                "https://www.zzuli.edu.cn/2026/1016/c22481a361564/page.htm",
                "https://www.zzuli.edu.cn/2026/1014/c22481a361391/page.htm"), links);
    }

    @Test
    @DisplayName("links: a fragment does not make the same article two items")
    void fragmentsAreDropped() {
        String html = "<html><body>"
                + "<a href=\"/news/a.html#top\">第一条新闻标题</a>"
                + "<a href=\"/news/b.html\">第二条新闻标题</a>"
                + "</body></html>";
        List<String> links = extractor.articleLinks(
                org.jsoup.Jsoup.parse(html, "https://example.com/"),
                URI.create("https://example.com/"), 10);
        assertEquals(List.of("https://example.com/news/a.html", "https://example.com/news/b.html"), links);
    }

    @Test
    @DisplayName("links: another host is never followed")
    void otherHostsAreSkipped() {
        String html = "<html><body>"
                + "<a href=\"https://other.com/news/a.html\">别站的一条长标题新闻</a>"
                + "<a href=\"/news/b.html\">本站的一条长标题新闻</a>"
                + "</body></html>";
        List<String> links = extractor.articleLinks(
                org.jsoup.Jsoup.parse(html, "https://example.com/"),
                URI.create("https://example.com/"), 10);
        assertEquals(List.of("https://example.com/news/b.html"), links);
    }

    @Test
    @DisplayName("links: the cap holds even when every link looks like an article")
    void capHolds() {
        StringBuilder sb = new StringBuilder("<html><body>");
        for (int i = 0; i < 40; i++) sb.append("<a href=\"/news/").append(i).append(".html\">第 ").append(i).append(" 条新闻标题</a>");
        sb.append("</body></html>");
        List<String> links = extractor.articleLinks(
                org.jsoup.Jsoup.parse(sb.toString(), "https://example.com/"),
                URI.create("https://example.com/"), 10);
        assertEquals(10, links.size());
    }
}
