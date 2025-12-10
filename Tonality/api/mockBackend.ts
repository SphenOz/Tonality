// Mock backend for polls
export interface Poll {
    id: string;
    title: string;
    songs: PollSong[];
}

export interface PollSong {
    id: string;
    name: string;
    artist: string;
    albumArt?: string;
    votes: number;
}

const mockPolls: Poll[] = [
    {
        id: 'poll-1',
        title: 'Best Indie Track This Week',
        songs: [
            { id: '1', name: 'Heat Waves', artist: 'Glass Animals', votes: 42 },
            { id: '2', name: 'electric feel', artist: 'MGMT', votes: 38 },
            { id: '3', name: 'Tame', artist: 'Pixies', votes: 23 },
            { id: '4', name: 'Little Dark Age', artist: 'MGMT', votes: 51 },
        ],
    },
];

// Store votes in memory
const userVotes = new Map<string, string>(); // pollId -> songId

export async function getCurrentPoll(): Promise<Poll | null> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return mockPolls[0] || null;
}

export async function voteForSong(pollId: string, songId: string): Promise<void> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));

    const poll = mockPolls.find(p => p.id === pollId);
    if (!poll) throw new Error('Poll not found');

    // Remove vote from previous song
    const previousVote = userVotes.get(pollId);
    if (previousVote) {
        const previousSong = poll.songs.find(s => s.id === previousVote);
        if (previousSong) previousSong.votes--;
    }

    // Add vote to new song
    const song = poll.songs.find(s => s.id === songId);
    if (!song) throw new Error('Song not found');
    song.votes++;

    // Store user's vote
    userVotes.set(pollId, songId);
}

export function getUserVote(pollId: string): string | undefined {
    return userVotes.get(pollId);
}
