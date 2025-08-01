export interface TMDBMovie {
    id: number;
    title: string;
    overview: string;
    release_date: string;
    poster_path?: string;
    backdrop_path?: string;
    vote_average: number;
    vote_count: number;
    adult: boolean;
    original_language: string;
    original_title: string;
    popularity: number;
    video: boolean;
    genre_ids: number[];
}

export interface TMDBTVShow {
    id: number;
    name: string;
    overview: string;
    first_air_date: string;
    poster_path?: string;
    backdrop_path?: string;
    vote_average: number;
    vote_count: number;
    adult: boolean;
    original_language: string;
    original_name: string;
    popularity: number;
    genre_ids: number[];
    origin_country: string[];
}

export interface TMDBSeason {
    id: number;
    name: string;
    overview: string;
    episode_count: number;
    poster_path?: string;
    season_number: number;
    air_date: string;
}

export interface TMDBEpisode {
    id: number;
    name: string;
    overview: string;
    episode_number: number;
    season_number: number;
    air_date: string;
    still_path?: string;
    vote_average: number;
    vote_count: number;
    runtime?: number;
}

export interface TMDBSearchResponse {
    page: number;
    results: (TMDBMovie | TMDBTVShow)[];
    total_pages: number;
    total_results: number;
}

export interface MediaInfo {
    id: number;
    title: string;
    type: 'movie' | 'tv';
    year: number;
    poster: string | null;
    backdrop: string | null;
    overview: string;
    imdbId?: string;
    tmdbId: string;
    season?: number;
    episode?: number;
}
