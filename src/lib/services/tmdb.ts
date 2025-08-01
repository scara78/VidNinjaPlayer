import axios from 'axios';
import { TMDBMovie, TMDBTVShow, TMDBSearchResponse, MediaInfo, TMDBSeason, TMDBEpisode } from '@/types/tmdb';

// Use the proxy URL instead of direct TMDB API
const TMDB_PROXY_BASE_URL = 'https://proxy-tmdb-weld.vercel.app/api';
const TMDB_IMAGE_PROXY_BASE_URL = 'https://proxy-tmdb-weld.vercel.app/api/image';

export class TMDBService {
    constructor() {
        // No API key needed with proxy
    }

    private async makeRequest<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T> {
        try {
            const url = new URL(`${TMDB_PROXY_BASE_URL}${endpoint}`);

            // Add query parameters
            Object.entries(params).forEach(([key, value]) => {
                url.searchParams.append(key, value.toString());
            });

            const response = await axios.get(url.toString());
            return response.data;
        } catch (error) {
            console.error('TMDB Proxy API Error:', error);
            throw new Error('Failed to search TMDB');
        }
    }

    async searchMulti(query: string): Promise<MediaInfo[]> {
        const response = await this.makeRequest<TMDBSearchResponse>('/search', { query });

        return response.results.map(item => {
            const isMovie = 'title' in item;
            const title = isMovie ? item.title : item.name;
            const releaseDate = isMovie ? item.release_date : item.first_air_date;
            const year = releaseDate ? new Date(releaseDate).getFullYear() : 0;

            return {
                id: item.id,
                title,
                type: isMovie ? 'movie' : 'tv',
                year,
                poster: item.poster_path ? this.getImageUrl(item.poster_path, 'w500') : null,
                backdrop: item.backdrop_path ? this.getImageUrl(item.backdrop_path, 'w1280') : null,
                overview: item.overview,
                tmdbId: item.id.toString(),
            };
        });
    }

    async getMovieDetails(movieId: number): Promise<MediaInfo> {
        const movie = await this.makeRequest<TMDBMovie>(`/movie/${movieId}`);

        // Get external IDs to fetch IMDB ID - using append_to_response for efficiency
        const movieWithExternalIds = await this.makeRequest<TMDBMovie & { external_ids?: { imdb_id?: string } }>(`/movie/${movieId}`, {
            append_to_response: 'external_ids'
        });

        return {
            id: movie.id,
            title: movie.title,
            type: 'movie',
            year: movie.release_date ? new Date(movie.release_date).getFullYear() : 0,
            poster: movie.poster_path ? this.getImageUrl(movie.poster_path, 'w500') : null,
            backdrop: movie.backdrop_path ? this.getImageUrl(movie.backdrop_path, 'w1280') : null,
            overview: movie.overview,
            tmdbId: movie.id.toString(),
            imdbId: movieWithExternalIds.external_ids?.imdb_id,
        };
    }

    async getTVShowDetails(tvId: number, season?: number, episode?: number): Promise<MediaInfo> {
        const tvShow = await this.makeRequest<TMDBTVShow>(`/tv/${tvId}`);

        // Get external IDs to fetch IMDB ID - using append_to_response for efficiency
        const tvShowWithExternalIds = await this.makeRequest<TMDBTVShow & { external_ids?: { imdb_id?: string } }>(`/tv/${tvId}`, {
            append_to_response: 'external_ids'
        });

        let title = tvShow.name;
        let backdrop = tvShow.backdrop_path ? this.getImageUrl(tvShow.backdrop_path, 'w1280') : null;

        // If specific season/episode requested, get more details
        if (season && episode) {
            try {
                const episodeDetails = await this.makeRequest<TMDBEpisode>(`/tv/${tvId}/season/${season}/episode/${episode}`);
                title = `${tvShow.name} - S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')} - ${episodeDetails.name}`;
                if (episodeDetails.still_path) {
                    backdrop = this.getImageUrl(episodeDetails.still_path, 'w1280');
                }
            } catch (error) {
                console.warn('Failed to fetch episode details:', error);
            }
        }

        return {
            id: tvShow.id,
            title,
            type: 'tv',
            year: tvShow.first_air_date ? new Date(tvShow.first_air_date).getFullYear() : 0,
            poster: tvShow.poster_path ? this.getImageUrl(tvShow.poster_path, 'w500') : null,
            backdrop,
            overview: tvShow.overview,
            tmdbId: tvShow.id.toString(),
            imdbId: tvShowWithExternalIds.external_ids?.imdb_id,
            season,
            episode,
        };
    }

    async getTVSeasons(tvId: number): Promise<TMDBSeason[]> {
        const tvShow = await this.makeRequest<TMDBTVShow & { seasons: TMDBSeason[] }>(`/tv/${tvId}`);
        return tvShow.seasons || [];
    }

    async getTVEpisodes(tvId: number, seasonNumber: number): Promise<TMDBEpisode[]> {
        const season = await this.makeRequest<{ episodes: TMDBEpisode[] }>(`/tv/${tvId}/season/${seasonNumber}`);
        return season.episodes || [];
    }

    getImageUrl(path: string, size: string = 'original'): string {
        // Use the proxy image URL
        return `${TMDB_IMAGE_PROXY_BASE_URL}/${size}${path}`;
    }

    // Helper method to get media info by TMDB ID
    async getMediaInfo(tmdbId: string, type: 'movie' | 'tv', season?: number, episode?: number): Promise<MediaInfo> {
        const id = parseInt(tmdbId);

        if (type === 'movie') {
            return this.getMovieDetails(id);
        } else {
            return this.getTVShowDetails(id, season, episode);
        }
    }
}

export const tmdbService = new TMDBService();
