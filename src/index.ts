interface Env {
  HARDCOVER_TOKEN: string;
}

interface Book {
  id: number;
  title: string;
  slug: string;
  image?: {
    url: string;
  };
  contributions?: Array<{
    author: {
      name: string;
    };
  }>;
}

interface UserBook {
  id: number;
  book_id: number;
  status_id: number;
  rating: number | null;
  date_added: string;
  last_read_date: string | null;
  book: Book;
}

interface GraphQLResponse {
  data?: {
    me: Array<{
      id: number;
      user_books: UserBook[];
    }>;
  };
  errors?: Array<{
    message: string;
  }>;
}

const GET_RATED_BOOKS_QUERY = `
  query GetRatedBooks($limit: Int!, $offset: Int!) {
    me {
      id
      user_books(
        where: { rating: { _is_null: false } }
        order_by: [{ last_read_date: desc_nulls_last }, { date_added: desc }]
        limit: $limit
        offset: $offset
      ) {
        id
        book_id
        status_id
        rating
        date_added
        last_read_date
        book {
          id
          title
          slug
          image {
            url
          }
          contributions {
            author {
              name
            }
          }
        }
      }
    }
  }
`;

async function fetchRatedBooksPage(
  token: string,
  limit: number,
  offset: number
): Promise<UserBook[]> {
  const response = await fetch('https://api.hardcover.app/v1/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      query: GET_RATED_BOOKS_QUERY,
      variables: { limit, offset },
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result: GraphQLResponse = await response.json();

  if (result.errors && result.errors.length > 0) {
    throw new Error(result.errors[0].message);
  }

  if (!result.data) {
    throw new Error('No data returned from GraphQL query');
  }

  return result.data.me?.[0]?.user_books || [];
}

async function fetchAllRatedBooks(token: string): Promise<UserBook[]> {
  const allBooks: UserBook[] = [];
  const pageSize = 100;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const books = await fetchRatedBooksPage(token, pageSize, offset);

    if (books.length === 0) {
      hasMore = false;
    } else {
      allBooks.push(...books);
      offset += books.length;

      if (books.length < pageSize) {
        hasMore = false;
      }
    }
  }

  return allBooks;
}

function formatAsMarkdown(books: UserBook[]): string {
  if (books.length === 0) {
    return '# My Rated Books\n\nNo rated books found.';
  }

  // Group books by year
  const booksByYear = new Map<string, UserBook[]>();

  books.forEach((book) => {
    const year = book.last_read_date ? book.last_read_date.split('-')[0] : 'Undated';

    if (!booksByYear.has(year)) {
      booksByYear.set(year, []);
    }
    booksByYear.get(year)!.push(book);
  });

  // Sort years descending
  const sortedYears = Array.from(booksByYear.keys()).sort((a, b) => {
    if (a === 'Undated') return 1;
    if (b === 'Undated') return -1;
    return parseInt(b) - parseInt(a);
  });

  // Build markdown
  let markdown = `# My Rated Books\n\n${books.length} rated book(s)\n\n`;

  for (const year of sortedYears) {
    const yearBooks = booksByYear.get(year)!;
    const header = year === 'Undated' ? '## Undated' : `## ${year}`;
    markdown += `${header}\n\n`;

    yearBooks.forEach((userBook) => {
      const title = userBook.book.title;
      const author = userBook.book.contributions?.[0]?.author?.name || 'Unknown Author';
      const rating = userBook.rating || 0;
      const stars = '⭐'.repeat(rating);
      const dateRead = userBook.last_read_date
        ? ` - Read: ${userBook.last_read_date}`
        : '';

      markdown += `- **${title}** by ${author} ${stars} (${rating}/5)${dateRead}\n`;
    });

    markdown += '\n';
  }

  return markdown.trim();
}

const CACHE_KEY = 'hardcover-rated-books-cache';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const purge = url.searchParams.has('purge');

      if (!env.HARDCOVER_TOKEN) {
        return new Response('HARDCOVER_TOKEN not configured', { status: 500 });
      }

      const cache = caches.default;
      const cacheKey = new Request(new URL(CACHE_KEY, url.origin));

      if (!purge) {
        const cachedResponse = await cache.match(cacheKey);
        if (cachedResponse) {
          const headers = new Headers(cachedResponse.headers);
          headers.set('X-Cache', 'HIT');
          return new Response(cachedResponse.body, {
            status: cachedResponse.status,
            headers,
          });
        }
      }

      const books = await fetchAllRatedBooks(env.HARDCOVER_TOKEN);
      const markdown = formatAsMarkdown(books);

      const response = new Response(markdown, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
          'X-Cache': 'MISS',
        },
      });

      await cache.put(cacheKey, response.clone());

      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return new Response(`Error: ${message}`, { status: 500 });
    }
  },
};
