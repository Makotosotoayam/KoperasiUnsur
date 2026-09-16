import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { AppOptions } from '../types/models';

let cache: AppOptions | null = null;

export function useOptions() {
    const [options, setOptions] = useState<AppOptions | null>(cache);
    const [loading, setLoading] = useState(!cache);

    useEffect(() => {
        if (cache) return;

        api.get<AppOptions>('/options')
            .then(({ data }) => {
                cache = data;
                setOptions(data);
            })
            .finally(() => setLoading(false));
    }, []);

    const refresh = useCallback(async () => {
        const { data } = await api.get<AppOptions>('/options');
        cache = data;
        setOptions(data);
    }, []);

    return { options, loading, refresh };
}

export function clearOptionsCache() {
    cache = null;
}
